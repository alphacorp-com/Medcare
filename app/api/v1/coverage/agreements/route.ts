import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseAgreement, type AgreementInput } from "@/lib/coverage/input";
import { auditCoverage, coverageError, handleCoverageError, settingsGuard } from "@/lib/coverage/route-auth";

// Conventions with a payer: default rate, rates per family, ceilings, authorization rule.

// GET /api/v1/coverage/agreements?active=true — the conventions (with payer and rates), e.g. to
// pick one when covering a patient.
export async function GET(request: Request) {
  const guard = await settingsGuard("read");
  if (!guard.ok) return guard.response;
  const active = new URL(request.url).searchParams.get("active") === "true";
  const agreements = await prisma.coverageAgreement.findMany({
    where: { tenantId: guard.tenantId, ...(active ? { isActive: true, payer: { isActive: true } } : {}) },
    include: { payer: { select: { id: true, code: true, name: true } }, rates: true },
    orderBy: [{ payer: { name: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json({ data: agreements });
}

// POST /api/v1/coverage/agreements
// Body: { payerId, code, name, defaultRate, rates: [{ family, rate }], perInvoiceCeiling?, annualCeiling?,
//         requiresAuthorization?, authorizationThreshold?, validFrom?, validTo?, notes? }
export async function POST(request: Request) {
  try {
    const guard = await settingsGuard("write");
    if (!guard.ok) return guard.response;
    const parsed = parseAgreement(await request.json().catch(() => null), { partial: false });
    if (!parsed.ok) return coverageError(parsed.error);
    const { rates, payerId, ...fields } = parsed.value as AgreementInput;
    const payer = await prisma.payer.findFirst({ where: { id: payerId, tenantId: guard.tenantId }, select: { id: true } });
    if (!payer) return coverageError("invalid_payer");
    const agreement = await prisma.coverageAgreement.create({
      data: { ...fields, tenantId: guard.tenantId, payerId: payer.id, rates: { create: rates.map((r) => ({ ...r, tenantId: guard.tenantId })) } },
      include: { rates: true },
    });
    await auditCoverage(request, guard, "coverage.agreement_create", "coverage_agreement", agreement.id, { code: agreement.code, payerId, defaultRate: agreement.defaultRate, rates });
    return NextResponse.json({ data: agreement }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/coverage/agreements");
  }
}
