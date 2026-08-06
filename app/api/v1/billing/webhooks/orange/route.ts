import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { applySuccessfulPayment } from "@/lib/billing/applyPayment";

// POST /api/v1/billing/webhooks/orange — called by Orange's servers (notif_url) once the
// payer completes (or abandons) the payment page. No session: this is a server-to-server
// callback, matched by the pay_token we stored as Payment.providerReference at initiation.
// Requires a public HTTPS deployment to actually be reachable by Orange — not testable from
// a local dev environment.
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const payToken: string | undefined = payload?.pay_token ?? payload?.notif_token;
    const status: string | undefined = payload?.status;

    if (!payToken) {
      return NextResponse.json({ error: "Missing pay_token" }, { status: 400 });
    }

    const payment = await prisma.payment.findFirst({ where: { providerReference: payToken } });
    if (!payment) {
      return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json({ ok: true });
    }

    const isSuccess = status === "SUCCESS" || status === "SUCCESSFULL" || status === "SUCCESSFUL";
    const nextStatus = isSuccess ? "successful" : "failed";

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        rawResponse: payload,
        completedAt: new Date(),
        failureReason: isSuccess ? null : `Orange Money status: ${status ?? "unknown"}`,
      },
    });

    if (isSuccess) {
      await applySuccessfulPayment(payment.invoiceId, Number(payment.amount));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/v1/billing/webhooks/orange]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
