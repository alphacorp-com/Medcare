import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { eligibleInvoices } from "@/lib/coverage/claims";
import { isUuid } from "@/lib/coverage/input";
import { billingGuard, coverageError } from "@/lib/coverage/route-auth";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/v1/billing/claims/eligible?payerId=&from=YYYY-MM-DD&to=YYYY-MM-DD — invoices that can go
// in a claim to this payer for the period.
export async function GET(request: Request) {
  const guard = await billingGuard("read");
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const payerId = params.get("payerId");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!isUuid(payerId)) return coverageError("invalid_payer");
  if (!DAY.test(from) || !DAY.test(to) || from > to) return coverageError("invalid_period");
  const payer = await prisma.payer.findFirst({ where: { id: payerId, tenantId: guard.tenantId }, select: { id: true } });
  if (!payer) return coverageError("invalid_payer");
  const invoices = await eligibleInvoices(guard.tenantId, payer.id, new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));
  return NextResponse.json({
    data: invoices.map((i) => ({
      id: i.id, createdAt: i.createdAt, patient: i.patient, memberNumber: i.coverage?.policy.memberNumber ?? null, holderName: i.coverage?.policy.holderName ?? null,
      relationship: i.coverage?.relationship ?? null, agreement: i.coverage?.policy.agreement.name ?? null,
      subtotal: Number(i.subtotal), insuranceAmount: Number(i.insuranceAmount), patientAmount: Number(i.patientAmount),
    })),
  });
}
