import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshMobileMoneyPayment } from "@/lib/payments/confirm";

// POST /api/v1/billing/webhooks/orange — called by Orange's servers (notif_url) once the
// payer completes (or abandons) the payment page. No session: a server-to-server callback.
// The body is only a cue: its `status` is ignored and the real status is read from Orange's
// transactionstatus API (lib/payments/confirm.ts), so a forged call cannot settle an invoice.
// The payment is found by the notif_token Orange returned at initiation (never shown to the
// payer), or by the pay_token. Requires a public HTTPS deployment to be reachable by Orange.
export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const notifToken = typeof payload?.notif_token === "string" ? payload.notif_token : null;
    const payToken = typeof payload?.pay_token === "string" ? payload.pay_token : null;
    if (!notifToken && !payToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        method: "mobile_money_orange",
        OR: [
          ...(notifToken ? [{ rawResponse: { path: ["notif_token"], equals: notifToken } }] : []),
          ...(payToken ? [{ providerReference: payToken }] : []),
        ],
      },
    });
    if (!payment) {
      return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
    }

    await refreshMobileMoneyPayment(payment);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/v1/billing/webhooks/orange]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
