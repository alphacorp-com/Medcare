import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { recalculateInvoiceTotals } from "@/lib/billing/suggestCharge";
import prisma from "@/lib/prisma";

// PATCH /api/v1/billing/[id]/lines/[lineId] — correct the price/quantity/description of an
// existing line (e.g. a tariff was misconfigured when the line was auto-generated).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_BILLING", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id, lineId } = await params;

    const invoice = await prisma.patientInvoice.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return NextResponse.json({ error: `Cannot edit a line on a ${invoice.status} invoice` }, { status: 400 });
    }

    const line = await prisma.patientInvoiceLine.findFirst({ where: { id: lineId, invoiceId: id } });
    if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 });

    const body = await request.json();
    const { description, quantity, unitPrice } = body as {
      description?: string;
      quantity?: number | string;
      unitPrice?: number | string;
    };

    const nextQuantity = quantity === undefined || quantity === null || quantity === "" ? Number(line.quantity) : Number(quantity);
    const nextUnitPrice = unitPrice === undefined || unitPrice === null || unitPrice === "" ? Number(line.unitPrice) : Number(unitPrice);
    if (Number.isNaN(nextQuantity) || nextQuantity <= 0 || Number.isNaN(nextUnitPrice) || nextUnitPrice < 0) {
      return NextResponse.json({ error: "quantity and unitPrice must be valid numbers" }, { status: 400 });
    }

    const updated = await prisma.patientInvoiceLine.update({
      where: { id: lineId },
      data: {
        description: description?.trim() || line.description,
        quantity: nextQuantity,
        unitPrice: nextUnitPrice,
        amount: nextQuantity * nextUnitPrice,
      },
    });

    await recalculateInvoiceTotals(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/billing/[id]/lines/[lineId]]", error);
    return NextResponse.json({ error: "Failed to update invoice line" }, { status: 400 });
  }
}
