import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";
import { getMobileMoneyConfig, resolveOrangeConfig, resolveMtnConfig } from "@/lib/payments/config";
import { initiateOrangePayment } from "@/lib/payments/mobile-money/orange";
import { initiateMtnPayment } from "@/lib/payments/mobile-money/mtn";
import { applySuccessfulPayment } from "@/lib/billing/applyPayment";

const INSTANT_METHODS: PaymentMethod[] = ["cash", "card", "insurance", "bank_transfer"];

// POST /api/v1/billing/[id]/payments — record a payment against an invoice.
// cash/card/insurance/bank_transfer settle synchronously. mobile_money_* initiate a
// real gateway request and come back "pending" until the webhook/status poll confirms.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_BILLING", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    if (!session.user.tenantId) {
      return NextResponse.json({ error: "No tenant on session" }, { status: 400 });
    }

    const { id: invoiceId } = await params;
    const invoice = await prisma.patientInvoice.findFirst({
      where: { id: invoiceId, tenantId: session.user.tenantId },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return NextResponse.json({ error: `Cannot pay a ${invoice.status} invoice` }, { status: 400 });
    }

    const body = await request.json();
    const { method, amount, phoneNumber, reference } = body as {
      method?: PaymentMethod;
      amount?: number | string;
      phoneNumber?: string;
      reference?: string;
    };

    const validMethods: PaymentMethod[] = [...INSTANT_METHODS, "mobile_money_orange", "mobile_money_mtn"];
    if (!method || !validMethods.includes(method)) {
      return NextResponse.json({ error: "A valid payment method is required" }, { status: 400 });
    }

    const outstanding = Number(invoice.patientAmount) - Number(invoice.paidAmount);
    const paymentAmount = amount === undefined || amount === null ? outstanding : Number(amount);
    if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    if (INSTANT_METHODS.includes(method)) {
      const payment = await prisma.payment.create({
        data: {
          tenantId: session.user.tenantId,
          invoiceId,
          amount: paymentAmount,
          method,
          status: "successful",
          currency: invoice.currency,
          providerReference: reference || null,
          initiatedById: session.user.id,
          completedAt: new Date(),
        },
      });
      await applySuccessfulPayment(invoiceId, paymentAmount);
      return NextResponse.json(payment, { status: 201 });
    }

    // Mobile money: requires a phone number and a configured, enabled provider.
    if (!phoneNumber) {
      return NextResponse.json({ error: "phoneNumber is required for mobile money payments" }, { status: 400 });
    }

    const storedConfig = await getMobileMoneyConfig(session.user.tenantId);

    const payment = await prisma.payment.create({
      data: {
        tenantId: session.user.tenantId,
        invoiceId,
        amount: paymentAmount,
        method,
        status: "pending",
        currency: invoice.currency,
        phoneNumber,
        initiatedById: session.user.id,
      },
    });

    if (method === "mobile_money_orange") {
      const config = resolveOrangeConfig(storedConfig);
      if (!config) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", failureReason: "Orange Money is not configured for this tenant" } });
        return NextResponse.json({ error: "Orange Money is not configured for this tenant" }, { status: 400 });
      }

      const origin = new URL(request.url).origin;
      const result = await initiateOrangePayment(config, {
        amount: paymentAmount,
        currency: invoice.currency,
        phoneNumber,
        reference: payment.id,
        description: `Facture ${invoiceId.slice(0, 8)}`,
        returnUrl: `${origin}/billing/${invoiceId}`,
        cancelUrl: `${origin}/billing/${invoiceId}`,
        notifyUrl: `${origin}/api/v1/billing/webhooks/orange`,
      });

      if (!result.success) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "failed", failureReason: result.error, rawResponse: result.raw as any },
        });
        return NextResponse.json({ error: result.error }, { status: 502 });
      }

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: { providerReference: result.providerReference, rawResponse: result.raw as any },
      });
      return NextResponse.json({ ...updated, redirectUrl: result.redirectUrl }, { status: 201 });
    }

    // mobile_money_mtn
    const config = resolveMtnConfig(storedConfig);
    if (!config) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", failureReason: "MTN MoMo is not configured for this tenant" } });
      return NextResponse.json({ error: "MTN MoMo is not configured for this tenant" }, { status: 400 });
    }

    const result = await initiateMtnPayment(config, {
      amount: paymentAmount,
      currency: invoice.currency,
      phoneNumber,
      reference: payment.id,
      description: `Facture ${invoiceId.slice(0, 8)}`,
    });

    if (!result.success) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed", failureReason: result.error, rawResponse: result.raw as any },
      });
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { providerReference: result.providerReference, rawResponse: result.raw as any },
    });
    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/billing/[id]/payments]", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 400 });
  }
}
