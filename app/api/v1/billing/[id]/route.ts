import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// GET /api/v1/billing/[id] — invoice detail: patient, stay, lines, payments
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_BILLING", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await params;

  const invoice = await prisma.patientInvoice.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, ipp: true } },
      stay: { select: { id: true, stayNumber: true, admissionDate: true, dischargeDate: true } },
      lines: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { initiatedAt: "desc" } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  return NextResponse.json(invoice);
}

// PATCH /api/v1/billing/[id] — update notes, insurance amount, or cancel
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const body = await request.json();
    const { notes, insuranceAmount, status } = body as {
      notes?: string;
      insuranceAmount?: number | string;
      status?: "cancelled";
    };

    const invoice = await prisma.patientInvoice.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const nextInsuranceAmount =
      insuranceAmount === undefined || insuranceAmount === null ? Number(invoice.insuranceAmount) : Number(insuranceAmount);
    if (Number.isNaN(nextInsuranceAmount)) {
      return NextResponse.json({ error: "insuranceAmount must be a number" }, { status: 400 });
    }

    const updated = await prisma.patientInvoice.update({
      where: { id },
      data: {
        notes: notes !== undefined ? notes || null : undefined,
        insuranceAmount: nextInsuranceAmount,
        patientAmount: Number(invoice.subtotal) - nextInsuranceAmount,
        status: status === "cancelled" ? "cancelled" : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/billing/[id]]", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 400 });
  }
}
