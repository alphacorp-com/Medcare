import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parsePayer, type PayerInput } from "@/lib/coverage/input";
import { isFacilityInsuranceType } from "@/lib/coverage/references";
import { auditCoverage, coverageError, handleCoverageError, settingsGuard } from "@/lib/coverage/route-auth";

// Payers (CNPS, insurers, mutuals, employers…) and their conventions — facility settings.

// GET /api/v1/coverage/payers — payers with their conventions (rates included).
export async function GET() {
  const guard = await settingsGuard("read");
  if (!guard.ok) return guard.response;
  const payers = await prisma.payer.findMany({
    where: { tenantId: guard.tenantId },
    include: { insuranceType: { select: { id: true, code: true, nameFr: true } }, agreements: { include: { rates: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: payers });
}

// POST /api/v1/coverage/payers — Body: { code, name, insuranceTypeId?, contactName?, phone?, email?, address? }
export async function POST(request: Request) {
  try {
    const guard = await settingsGuard("write");
    if (!guard.ok) return guard.response;
    const parsed = parsePayer(await request.json().catch(() => null), { partial: false });
    if (!parsed.ok) return coverageError(parsed.error);
    const v = parsed.value as PayerInput;
    if (!(await isFacilityInsuranceType(guard.tenantId, v.insuranceTypeId))) return coverageError("invalid_insurance_type");
    const payer = await prisma.payer.create({ data: { ...v, tenantId: guard.tenantId } });
    await auditCoverage(request, guard, "coverage.payer_create", "payer", payer.id, { code: payer.code, name: payer.name });
    return NextResponse.json({ data: payer }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/coverage/payers");
  }
}
