import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClaim, receivablesByPayer } from "@/lib/coverage/claims";
import { parseClaimCreate } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// Claims to payers ("bordereaux").

// GET /api/v1/billing/claims?payerId= — claims with their totals, and the receivable per payer.
export async function GET(request: Request) {
  const guard = await billingGuard("read");
  if (!guard.ok) return guard.response;
  const payerId = new URL(request.url).searchParams.get("payerId");
  const [claims, receivables] = await Promise.all([
    prisma.insuranceClaim.findMany({
      where: { tenantId: guard.tenantId, ...(payerId ? { payerId } : {}) },
      include: { payer: { select: { id: true, name: true } }, items: { select: { claimedAmount: true, paidAmount: true, rejectedAmount: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    receivablesByPayer(guard.tenantId),
  ]);
  const data = claims.map(({ items, ...claim }) => ({
    ...claim,
    invoiceCount: items.length,
    claimed: items.reduce((s, i) => s + Number(i.claimedAmount), 0),
    paid: items.reduce((s, i) => s + Number(i.paidAmount), 0),
    rejected: items.reduce((s, i) => s + Number(i.rejectedAmount), 0),
  }));
  return NextResponse.json({ data, receivables });
}

// POST /api/v1/billing/claims — Body: { payerId, periodStart, periodEnd, invoiceIds[], notes? } → draft claim.
export async function POST(request: Request) {
  try {
    const guard = await billingGuard("create");
    if (!guard.ok) return guard.response;
    const parsed = parseClaimCreate(await request.json().catch(() => null));
    if (!parsed.ok) return coverageError(parsed.error);
    const claim = await createClaim(guard.tenantId, guard.userId, parsed.value);
    await auditCoverage(request, guard, "billing.claim_create", "insurance_claim", claim.id, { number: claim.number, payerId: claim.payerId, invoices: parsed.value.invoiceIds.length });
    return NextResponse.json({ data: claim }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/billing/claims");
  }
}
