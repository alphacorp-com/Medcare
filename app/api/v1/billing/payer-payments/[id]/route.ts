import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cancelPayerPayment } from "@/lib/coverage/claims";
import { parseReason } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// GET /api/v1/billing/payer-payments/[id] — a settlement, its allocations and refunds.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await billingGuard("read");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const payment = await prisma.payerPayment.findFirst({
    where: { id, tenantId: guard.tenantId },
    include: {
      payer: { select: { id: true, name: true } },
      claim: { select: { id: true, number: true } },
      allocations: {
        orderBy: { createdAt: "asc" },
        include: { claimItem: { select: { claim: { select: { id: true, number: true } }, invoice: { select: { id: true, createdAt: true, patient: { select: { firstName: true, lastName: true, ipp: true } } } } } } },
      },
      refunds: { orderBy: { refundedAt: "asc" } },
    },
  });
  if (!payment) return coverageError("not_found", 404);
  return NextResponse.json({ data: payment });
}

// PATCH /api/v1/billing/payer-payments/[id] — Body: { status: "cancelled", reason }: a settlement
// recorded by mistake, once nothing is allocated nor refunded on it. Audited.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
    if (body?.status !== "cancelled") return coverageError("invalid_status");
    const reason = parseReason(body);
    if (!reason.ok) return coverageError(reason.error);
    await cancelPayerPayment(guard.tenantId, id, reason.value);
    await auditCoverage(request, guard, "billing.payer_payment_cancel", "payer_payment", id, { reason: reason.value });
    return NextResponse.json({ data: { id, status: "cancelled" } });
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/billing/payer-payments/[id]");
  }
}
