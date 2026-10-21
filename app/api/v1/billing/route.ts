import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import { BillingInvoiceStatus, type Prisma } from "@prisma/client";

// GET /api/v1/billing — paged invoice list for the tenant: ?status=, ?search=, ?page=, ?pageSize=.
// Also returns per-status counts and the outstanding balance over the WHOLE tenant (not the
// current filter), for the summary tiles.
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
    const rawStatus = searchParams.get("status");
    const status = rawStatus && (Object.values(BillingInvoiceStatus) as string[]).includes(rawStatus)
      ? (rawStatus as BillingInvoiceStatus)
      : null;
    const search = searchParams.get("search")?.trim();

    const pagination = parsePagination(searchParams);
    const tenantScope: Prisma.PatientInvoiceWhereInput = { tenantId: session.user.tenantId };
    const where: Prisma.PatientInvoiceWhereInput = {
      ...tenantScope,
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
    };

    const [invoices, total, statusGroups, outstanding] = await Promise.all([
      prisma.patientInvoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          patient: { select: { firstName: true, lastName: true, ipp: true } },
          stay: { select: { stayNumber: true } },
          _count: { select: { lines: true } },
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.patientInvoice.count({ where }),
      prisma.patientInvoice.groupBy({ by: ["status"], where: tenantScope, _count: true }),
      // Same rule as before: everything neither paid nor cancelled (drafts included).
      prisma.patientInvoice.aggregate({
        where: { ...tenantScope, status: { notIn: ["paid", "cancelled"] } },
        _sum: { patientAmount: true, paidAmount: true },
      }),
    ]);

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

    const counts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count]));
    const outstandingBalance = Number(outstanding._sum.patientAmount ?? 0) - Number(outstanding._sum.paidAmount ?? 0);

    return NextResponse.json({
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      counts,
      outstandingBalance,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/billing]", error);
    return NextResponse.json({ error: "Failed to fetch invoices", success: false }, { status: 500 });
  }
}
