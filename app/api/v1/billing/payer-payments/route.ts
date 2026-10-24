import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordPayerPayment } from "@/lib/coverage/claims";
import { parsePayerPayment } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// Settlements received from payers.

// GET /api/v1/billing/payer-payments?payerId= — the latest settlements with what was allocated.
export async function GET(request: Request) {
  const guard = await billingGuard("read");
  if (!guard.ok) return guard.response;
  const payerId = new URL(request.url).searchParams.get("payerId");
  const payments = await prisma.payerPayment.findMany({
    where: { tenantId: guard.tenantId, ...(payerId ? { payerId } : {}) },
    include: { payer: { select: { name: true } }, claim: { select: { number: true } }, allocations: { where: { reversedAt: null }, select: { amount: true } }, refunds: { select: { amount: true } } },
    orderBy: { receivedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    data: payments.map(({ allocations, refunds, ...p }) => {
      const allocated = allocations.reduce((s, a) => s + Number(a.amount), 0);
      const refunded = refunds.reduce((s, r) => s + Number(r.amount), 0);
      return { ...p, allocated, refunded, unallocated: p.status === "cancelled" ? 0 : Number(p.amount) - allocated - refunded };
    }),
  });
}

// POST /api/v1/billing/payer-payments
// Body: { payerId, claimId?, amount, receivedAt, method, reference?, notes?, allocations?: [{ itemId, amount }] }
// Without allocations, the amount settles the oldest outstanding items first.
export async function POST(request: Request) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const parsed = parsePayerPayment(await request.json().catch(() => null));
    if (!parsed.ok) return coverageError(parsed.error);
    const { payment, allocated } = await recordPayerPayment(guard.tenantId, guard.userId, parsed.value);
    await auditCoverage(request, guard, "billing.payer_payment", "payer_payment", payment.id, { payerId: payment.payerId, claimId: payment.claimId, amount: parsed.value.amount, allocated, reference: payment.reference });
    return NextResponse.json({ data: { ...payment, allocated } }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/billing/payer-payments");
  }
}
