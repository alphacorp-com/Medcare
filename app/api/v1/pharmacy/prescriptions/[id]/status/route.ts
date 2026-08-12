import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { isModuleActiveForTenant } from "@/lib/tenant-licensing";
import { suggestInvoiceLines } from "@/lib/billing/suggestCharge";
import prisma from "@/lib/prisma";
import { Prisma, type PrescriptionStatus } from "@prisma/client";

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

    const updateData: Prisma.PrescriptionUpdateInput = {
      status: status as PrescriptionStatus,
      ...(status === 'validated' ? { validatedAt: new Date() } : {})
    };

    let billing: unknown = null;

    if (status === 'validated' && tenantId) {
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

    if (status === 'dispensed') {
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

      const inventory = await prisma.medicationInventory.findMany({
        where: { isActive: true, tenantId },
        select: { id: true, name: true, stock: true }
      });
      const inventoryMap = new Map(inventory.map(i => [i.name.toLowerCase(), i]));

      for (const item of itemsList) {
        const drugName = item.drug || item.name || '';
        const invItem = inventoryMap.get(drugName.toLowerCase());
        const quantity = parseFloat(String(item.quantity)) || 0;

        if (invItem) {
          await prisma.medicationInventory.update({
            where: { id: invItem.id },
            data: { stock: Math.max(0, invItem.stock - quantity) }
          });
        }

        await prisma.drugDispensing.create({
          data: {
            tenantId,
            prescriptionId: currentRx.id,
            patientId: currentRx.patientId,
            pharmacistId: session.user.id,
            drugCode: invItem?.id || slugifyDrugName(drugName),
            drugName,
            quantity,
            unit: item.unit || null,
            status: "dispensed",
          },
        });
      }
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ data: prescription, billing, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/pharmacy/prescriptions/[id]/status]", error);
    return NextResponse.json(
      { error: "Failed to update prescription status", success: false },
      { status: 500 }
    );
  }
}
