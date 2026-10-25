import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshMobileMoneyPayment } from "@/lib/payments/confirm";
import { isUuid } from "@/lib/coverage/input";

// POST /api/v1/billing/webhooks/mtn — optional callback target (X-Callback-Url) for MTN
// MoMo's requestToPay. MTN's Collections API is usable purely via polling (see
// app/api/v1/billing/payments/[id]/status/route.ts), so this webhook is a production
// optimization, not a hard requirement — not testable from a local dev environment since
// MTN cannot reach a non-public URL.
// The body is only a cue: its `status` is ignored and the real status is read from MTN's
// requesttopay API (lib/payments/confirm.ts), so a forged call cannot settle an invoice.
export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const referenceId = typeof payload?.referenceId === "string" ? payload.referenceId : null;
    // externalId is the reference we sent at initiation: our Payment.id.
    const externalId = isUuid(payload?.externalId) ? payload.externalId : null;
    if (!referenceId && !externalId) {
      return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        method: "mobile_money_mtn",
        OR: [
          ...(referenceId ? [{ providerReference: referenceId }] : []),
          ...(externalId ? [{ id: externalId }] : []),
        ],
      },
    });
    if (!payment) {
      return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
    }

    await refreshMobileMoneyPayment(payment);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/v1/billing/webhooks/mtn]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
