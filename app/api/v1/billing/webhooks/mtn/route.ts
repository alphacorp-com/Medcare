import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { applySuccessfulPayment } from "@/lib/billing/applyPayment";

// POST /api/v1/billing/webhooks/mtn — optional callback target (X-Callback-Url) for MTN
// MoMo's requestToPay. MTN's Collections API is usable purely via polling (see
// app/api/v1/billing/payments/[id]/status/route.ts), so this webhook is a production
// optimization, not a hard requirement — not testable from a local dev environment since
// MTN cannot reach a non-public URL.
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const referenceId: string | undefined = payload?.referenceId ?? payload?.externalId;
    const status: string | undefined = payload?.status;

    if (!referenceId) {
      return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    }

    const payment = await prisma.payment.findFirst({ where: { providerReference: referenceId } });
    if (!payment) {
      return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json({ ok: true });
    }

    const isSuccess = status === "SUCCESSFUL";
    const nextStatus = isSuccess ? "successful" : "failed";

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        rawResponse: payload,
        completedAt: new Date(),
        failureReason: isSuccess ? null : `MTN MoMo status: ${status ?? "unknown"}`,
      },
    });

    if (isSuccess) {
      await applySuccessfulPayment(payment.invoiceId, Number(payment.amount));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/v1/billing/webhooks/mtn]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
