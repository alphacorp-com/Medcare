import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { getMobileMoneyConfig, resolveMtnConfig } from "@/lib/payments/config";
import { checkMtnPaymentStatus } from "@/lib/payments/mobile-money/mtn";
import { applySuccessfulPayment } from "@/lib/billing/applyPayment";

// GET /api/v1/billing/payments/[id]/status — poll a pending mobile money payment.
// MTN supports a real merchant-initiated status check; Orange Money only reports status
// via its webhook, so for an Orange payment this just returns whatever is in the DB.
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

  if (payment.status !== "pending" || payment.method !== "mobile_money_mtn" || !payment.providerReference) {
    return NextResponse.json(payment);
  }

  try {
    const storedConfig = await getMobileMoneyConfig(session.user.tenantId);
    const config = resolveMtnConfig(storedConfig);
    if (!config) return NextResponse.json(payment);

    const result = await checkMtnPaymentStatus(config, payment.providerReference);

    if (result.status === "pending") {
      return NextResponse.json(payment);
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: result.status,
        rawResponse: result.raw as any,
        completedAt: new Date(),
        failureReason: result.status === "failed" ? "MTN MoMo reported a failed transaction" : null,
      },
    });

    if (result.status === "successful") {
      await applySuccessfulPayment(payment.invoiceId, Number(payment.amount));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[GET /api/v1/billing/payments/[id]/status]", error);
    return NextResponse.json(payment);
  }
}
