import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseProgram, type ProgramInput } from "@/lib/coverage/input";
import { areFacilityArticles } from "@/lib/coverage/references";
import { recalcOpenInvoices } from "@/lib/coverage/recalc";
import { auditCoverage, coverageError, handleCoverageError, settingsGuard } from "@/lib/coverage/route-auth";

// Free-care programmes (gratuités): applied before the payer on every invoice line they cover.

// GET /api/v1/coverage/programs — all programmes, with their enrolment count.
export async function GET() {
  const guard = await settingsGuard("read");
  if (!guard.ok) return guard.response;
  const programs = await prisma.exemptionProgram.findMany({
    where: { tenantId: guard.tenantId },
    include: { _count: { select: { enrolments: { where: { revokedAt: null } } } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: programs });
}

// POST /api/v1/coverage/programs
// Body: { code, name, rate, families[], actCodes?, inventoryItemIds?, eligibility, minAgeMonths?, maxAgeMonths?,
//         sex?, pregnantOnly?, validFrom?, validTo?, notes? }
export async function POST(request: Request) {
  try {
    const guard = await settingsGuard("write");
    if (!guard.ok) return guard.response;
    const parsed = parseProgram(await request.json().catch(() => null), { partial: false });
    if (!parsed.ok) return coverageError(parsed.error);
    const v = parsed.value as ProgramInput;
    if (!(await areFacilityArticles(guard.tenantId, v.inventoryItemIds))) return coverageError("invalid_articles");
    const program = await prisma.exemptionProgram.create({ data: { ...v, tenantId: guard.tenantId } });
    // An automatic programme applies at once to the open invoices.
    if (program.eligibility === "automatic") await recalcOpenInvoices({ tenantId: guard.tenantId });
    await auditCoverage(request, guard, "coverage.program_create", "exemption_program", program.id, { code: program.code, rate: program.rate, families: program.families, eligibility: program.eligibility });
    return NextResponse.json({ data: program }, { status: 201 });
  } catch (error) {
    return handleCoverageError(error, "POST /api/v1/coverage/programs");
  }
}
