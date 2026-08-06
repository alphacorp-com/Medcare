import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { recalculateInvoiceTotals } from "@/lib/billing/suggestCharge";
import prisma from "@/lib/prisma";

// POST /api/v1/billing/[id]/lines — add a manual ("other") charge to an existing invoice
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_BILLING", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const invoice = await prisma.patientInvoice.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return NextResponse.json({ error: `Cannot add a line to a ${invoice.status} invoice` }, { status: 400 });
    }

    const body = await request.json();
    const { description, quantity, unitPrice } = body as {
      description?: string;
      quantity?: number | string;
      unitPrice?: number | string;
    };

    if (!description || unitPrice === undefined || unitPrice === null) {
      return NextResponse.json({ error: "description and unitPrice are required" }, { status: 400 });
    }

    const qty = Number(quantity ?? 1);
    const price = Number(unitPrice);
    if (Number.isNaN(qty) || Number.isNaN(price)) {
      return NextResponse.json({ error: "quantity and unitPrice must be numbers" }, { status: 400 });
    }

    const line = await prisma.patientInvoiceLine.create({
      data: {
        tenantId: session.user.tenantId,
        invoiceId: id,
        sourceType: "other",
        sourceId: null,
        description,
        quantity: qty,
        unitPrice: price,
        amount: qty * price,
      },
    });

    await recalculateInvoiceTotals(id);

    return NextResponse.json(line, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/billing/[id]/lines]", error);
    return NextResponse.json({ error: "Failed to add invoice line" }, { status: 400 });
  }
}
