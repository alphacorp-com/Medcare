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
import { lineDrugName, lineUnits, parseStoredLines, resolveLineArticle, type StoredPrescriptionLine } from "@/lib/stock/prescription-items";
import { removeUnpaidCharge } from "@/lib/billing/paymentGate";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";

const MAX_CANCEL_REASON = 1_000;

// A line the prescriber marked as a drug the pharmacy does not stock (inventoryId: null):
// neither billed nor dispensed by the pharmacy.
const isUnstockedLine = (line: StoredPrescriptionLine) => "inventoryId" in line && !line.inventoryId;

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

    // Forward transitions only: pending → validated → dispensed, or cancelled (with a reason)
    // before dispensing. Going back to "pending" is not a transition: it let a dispensed
    // prescription be validated and dispensed again (stock taken out twice).
    if (!status || !['validated', 'dispensed', 'cancelled'].includes(status)) {
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

    const itemsList = parseStoredLines(currentRx.items);

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
        const inventoryById = new Map(inventory.map((i) => [i.id, i]));
        const inventoryByName = new Map(inventory.map((i) => [i.name.toLowerCase(), i]));

        const lines = itemsList.filter((item) => !isUnstockedLine(item)).map((item) => {
          const drugName = lineDrugName(item);
          const invItem = resolveLineArticle(item, inventoryById, inventoryByName);
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
          const inventoryById = new Map(inventory.map((i) => [i.id, i]));
          const inventoryByName = new Map(inventory.map((i) => [i.name.toLowerCase(), i]));

          const dispensings: Prisma.DrugDispensingCreateManyInput[] = [];
          const dispensedAt = new Date();
          // The article comes from the line's inventoryId (name only for pre-rule lines).
          // Articles are locked in id order, so two dispensings sharing drugs always lock them
          // in the same order and can't deadlock.
          const resolved = itemsList
            .filter((item) => !isUnstockedLine(item))
            .map((item) => ({ item, article: resolveLineArticle(item, inventoryById, inventoryByName) }))
            .sort((a, b) => (a.article?.id ?? '').localeCompare(b.article?.id ?? ''));
          for (const { item, article: invItem } of resolved) {
            const drugName = lineDrugName(item);
            const quantity = parseFloat(String(item.quantity)) || 0;
            const dispensingId = randomUUID();
            let lot: { lotNumber: string; expiryDate: Date | null } | null = null;

            const units = lineUnits(item);
            if (invItem && units > 0) {
              // Stock is counted in whole units: a fractional quantity consumes the unit it
              // was taken from (never overstate what's left on the shelf).
              const { allocations } = await consumeStock(tx, {
                tenantId,
                userId: session.user.id,
                itemId: invItem.id,
                quantity: units,
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
    } else if (status === 'cancelled') {
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason) {
        return NextResponse.json({ error: "A reason is required to cancel a prescription", success: false }, { status: 400 });
      }
      if (reason.length > MAX_CANCEL_REASON) {
        return NextResponse.json({ error: "The reason is too long", success: false }, { status: 413 });
      }
      // A validated prescription is billed: it is cancelled only while nothing has been paid on
      // its lines (a payment is refunded through billing, not by cancelling the prescription).
      const billedLines = await prisma.patientInvoiceLine.findMany({
        where: { sourceType: "pharmacy_dispensation", sourceId: { startsWith: `${currentRx.id}:` } },
        select: { sourceId: true, invoice: { select: { status: true, paidAmount: true } } },
      });
      if (billedLines.some((line) => line.invoice.status !== "cancelled" && Number(line.invoice.paidAmount) > 0)) {
        return NextResponse.json(
          { error: "This prescription's invoice has already been paid: refund it from billing first", success: false },
          { status: 409 }
        );
      }
      const stamp = `[Annulée : ${reason}]`;
      const claimed = await prisma.prescription.updateMany({
        where: { id, tenantId, status: { in: ['pending', 'validated'] } },
        data: { status: 'cancelled', notes: currentRx.notes ? `${currentRx.notes}\n${stamp}` : stamp },
      });
      if (claimed.count !== 1) {
        return NextResponse.json(
          { error: "Only a pending or validated prescription can be cancelled", success: false },
          { status: 409 }
        );
      }
      for (const line of billedLines) {
        if (line.sourceId) await removeUnpaidCharge("pharmacy_dispensation", line.sourceId);
      }
      await recordAuditEvent({
        tenantId,
        actorId: session.user.id,
        actorType: "tenant_user",
        action: "pharmacy.prescription_cancelled",
        resourceType: "prescription",
        resourceId: id,
        payload: { reason, previousStatus: currentRx.status, removedInvoiceLines: billedLines.length },
        ...extractRequestMeta(request.headers),
      });
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
