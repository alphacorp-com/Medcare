import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { refreshMobileMoneyPayment } from "@/lib/payments/confirm";

// GET /api/v1/billing/payments/[id]/status — poll a pending mobile money payment.
// Asks the provider (MTN requesttopay, Orange transactionstatus) and settles the payment once
// it is final — the same path as the webhooks, so the invoice is credited exactly once.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_BILLING", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }
  if (!session.user.tenantId) {
    return NextResponse.json({ error: "No tenant on session" }, { status: 400 });
  }

  const { id } = await params;
  const payment = await prisma.payment.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  try {
    return NextResponse.json(await refreshMobileMoneyPayment(payment));
  } catch (error) {
    // Provider unreachable: the payment simply stays pending until the next poll.
    console.error("[GET /api/v1/billing/payments/[id]/status]", error);
    return NextResponse.json(payment);
  }
}
