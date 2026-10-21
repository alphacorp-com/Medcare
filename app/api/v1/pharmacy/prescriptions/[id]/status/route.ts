import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { isModuleActiveForTenant } from "@/lib/tenant-licensing";
import { suggestInvoiceLines } from "@/lib/billing/suggestCharge";
import prisma from "@/lib/prisma";
import { Prisma, type PrescriptionStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { StockError, consumeStock, stockErrorResponse } from "@/lib/stock/movements";

interface PharmacyPrescriptionItem {
  drug?: string;
  name?: string;
  quantity?: number | string;
  unit?: string;
}

function slugifyDrugName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['pending', 'validated', 'dispensed'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status", success: false },
        { status: 400 }
      );
    }

    const currentRx = await prisma.prescription.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { patient: true }
    });

    if (!currentRx) {
      return NextResponse.json(
        { error: "Prescription not found", success: false },
        { status: 404 }
      );
    }

    const tenantId = session.user.tenantId;

    let itemsList: PharmacyPrescriptionItem[] = [];
    try {
      if (typeof currentRx.items === 'string') {
        itemsList = JSON.parse(currentRx.items);
      } else if (Array.isArray(currentRx.items)) {
        itemsList = currentRx.items as unknown as PharmacyPrescriptionItem[];
      }
    } catch (e) {}

    let billing: unknown = null;

    // Each transition is claimed with a conditional update (status must still be the one it
    // comes from), the same pattern as the appointment check-in: two concurrent or repeated
    // requests can't both validate (double billing) or both dispense (double stock
    // decrement). The UI only offers pending → validated → dispensed.
    if (status === 'validated') {
      const claimed = await prisma.prescription.updateMany({
        where: { id, tenantId, status: 'pending' },
        data: { status: 'validated', validatedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return NextResponse.json(
          { error: "Only a pending prescription can be validated", success: false },
          { status: 409 }
        );
      }

      if (tenantId) {
        const inventory = await prisma.medicationInventory.findMany({
          where: { isActive: true, tenantId },
          select: { id: true, name: true, unitPrice: true }
        });
        const inventoryMap = new Map(inventory.map(i => [i.name.toLowerCase(), i]));

        const lines = itemsList.map((item) => {
          const drugName = item.drug || item.name || '';
          const invItem = inventoryMap.get(drugName.toLowerCase());
          const drugCode = invItem?.id || slugifyDrugName(drugName);
          const quantity = parseFloat(String(item.quantity)) || 0;
          return {
            sourceType: "pharmacy_dispensation" as const,
            sourceId: `${currentRx.id}:${drugCode}`,
            description: drugName,
            quantity,
            feeCode: drugCode,
            _unitPrice: invItem?.unitPrice ? Number(invItem.unitPrice) : 0,
          };
        });

        billing = await suggestInvoiceLines(
          tenantId,
          currentRx.patientId,
          currentRx.stayId,
          session.user.id,
          lines,
          (line) => (line as typeof lines[number])._unitPrice
        );
      }
    } else if (status === 'dispensed') {
      if (tenantId && (await isModuleActiveForTenant(tenantId, "MODULE_BILLING"))) {
        const openInvoiceLines = await prisma.patientInvoiceLine.findMany({
          where: { sourceType: "pharmacy_dispensation", sourceId: { startsWith: `${currentRx.id}:` } },
          include: { invoice: true },
        });

        const unpaidInvoice = openInvoiceLines.find((line) => line.invoice.status !== "paid");
        if (unpaidInvoice) {
          return NextResponse.json(
            { error: "Cannot dispense: the invoice for this prescription must be paid first", success: false },
            { status: 400 }
          );
        }
      }

      if (!tenantId) {
        return NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 });
      }

      // Stock exits (FEFO across the lots, see lib/stock), dispensing records and the status
      // change commit together or not at all. A drug without enough usable (non-expired) stock
      // refuses the whole dispensing (409 insufficient_stock): the pharmacist records the
      // receipt or the inventory count first, so the stock is never wrong.
      try {
        await prisma.$transaction(async (tx) => {
          const claimed = await tx.prescription.updateMany({
            where: { id, tenantId, status: 'validated' },
            data: { status: 'dispensed' },
          });
          if (claimed.count !== 1) throw new Error("RX_NOT_DISPENSABLE");

          const inventory = await tx.medicationInventory.findMany({
            where: { isActive: true, tenantId },
            select: { id: true, name: true },
          });
          const inventoryMap = new Map(inventory.map((i) => [i.name.toLowerCase(), i]));

          const dispensings: Prisma.DrugDispensingCreateManyInput[] = [];
          const dispensedAt = new Date();
          // Articles are locked in id order, so two dispensings sharing drugs always lock them
          // in the same order and can't deadlock.
          const inventoryIdOf = (item: PharmacyPrescriptionItem) => inventoryMap.get((item.drug || item.name || '').toLowerCase())?.id ?? '';
          const orderedItems = [...itemsList].sort((a, b) => inventoryIdOf(a).localeCompare(inventoryIdOf(b)));
          for (const item of orderedItems) {
            const drugName = item.drug || item.name || '';
            const invItem = inventoryMap.get(drugName.toLowerCase());
            const quantity = parseFloat(String(item.quantity)) || 0;
            const dispensingId = randomUUID();
            let lot: { lotNumber: string; expiryDate: Date | null } | null = null;

            if (invItem && quantity > 0) {
              // Stock is counted in whole units: a fractional quantity consumes the unit it
              // was taken from (never overstate what's left on the shelf).
              const { allocations } = await consumeStock(tx, {
                tenantId,
                userId: session.user.id,
                itemId: invItem.id,
                quantity: Math.ceil(quantity),
                type: "dispensing",
                sourceType: "drug_dispensing",
                sourceId: dispensingId,
                occurredAt: dispensedAt,
              });
              // Taken from several lots: each lot is in the stock movements, not on the row.
              if (allocations.length === 1) lot = allocations[0];
            }

            dispensings.push({
              id: dispensingId,
              lotNumber: lot?.lotNumber ?? null,
              expiryDate: lot?.expiryDate ?? null,
              dispensedAt,
              tenantId,
              prescriptionId: currentRx.id,
              patientId: currentRx.patientId,
              pharmacistId: session.user.id,
              drugCode: invItem?.id || slugifyDrugName(drugName),
              drugName,
              quantity,
              unit: item.unit || null,
              status: "dispensed",
            });
          }
          if (dispensings.length > 0) await tx.drugDispensing.createMany({ data: dispensings });
        });
      } catch (error) {
        if (error instanceof StockError) {
          const { status: httpStatus, body: errorBody } = stockErrorResponse(error);
          return NextResponse.json(errorBody, { status: httpStatus });
        }
        if (error instanceof Error && error.message === "RX_NOT_DISPENSABLE") {
          return NextResponse.json(
            { error: "Only a validated prescription can be dispensed", success: false },
            { status: 409 }
          );
        }
        throw error;
      }
    } else {
      await prisma.prescription.update({ where: { id }, data: { status: status as PrescriptionStatus } });
    }

    const prescription = await prisma.prescription.findUnique({ where: { id } });
    return NextResponse.json({ data: prescription, billing, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/pharmacy/prescriptions/[id]/status]", error);
    return NextResponse.json(
      { error: "Failed to update prescription status", success: false },
      { status: 500 }
    );
  }
}
