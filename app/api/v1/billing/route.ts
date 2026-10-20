import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { BillingInvoiceStatus } from "@prisma/client";

// GET /api/v1/billing — list invoices for the tenant (search + status filter).
// There is deliberately no POST: invoices and their lines are only ever generated server-side
// from clinical acts (lib/billing/suggestCharge.ts), priced from the catalog configured in
// Settings — the cashier collects payments but never sets a price.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_BILLING", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as BillingInvoiceStatus | null;
    const search = searchParams.get("search")?.trim();

    const invoices = await prisma.patientInvoice.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              patient: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                  { ipp: { contains: search, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { firstName: true, lastName: true, ipp: true } },
        stay: { select: { stayNumber: true } },
        _count: { select: { lines: true } },
      },
    });

    const data = invoices.map((invoice) => ({
      id: invoice.id,
      patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
      ipp: invoice.patient.ipp,
      stayNumber: invoice.stay?.stayNumber ?? null,
      status: invoice.status,
      subtotal: Number(invoice.subtotal),
      insuranceAmount: Number(invoice.insuranceAmount),
      patientAmount: Number(invoice.patientAmount),
      paidAmount: Number(invoice.paidAmount),
      currency: invoice.currency,
      lineCount: invoice._count.lines,
      createdAt: invoice.createdAt,
    }));

    return NextResponse.json({ data, total: data.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/billing]", error);
    return NextResponse.json({ error: "Failed to fetch invoices", success: false }, { status: 500 });
  }
}
