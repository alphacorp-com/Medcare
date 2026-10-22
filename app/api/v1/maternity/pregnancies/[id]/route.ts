import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { loadHivResultAccess, redactConfidentialExams } from "@/lib/hiv/confidential-results";
import prisma from "@/lib/prisma";
import { parsePregnancyOutcome } from "@/lib/maternity/input";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true, birthDate: true } as const;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  const pregnancy = await prisma.pregnancy.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      patient: { select: PATIENT_SELECT },
      antenatalVisits: {
        orderBy: { visitDate: "desc" },
        include: { tdImmunization: { select: { doseNumber: true, lotNumber: true } } },
      },
      postnatalVisits: { orderBy: { visitDate: "desc" } },
      examRequests: {
        where: { type: "biology" },
        include: { results: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { requestedAt: "desc" },
      },
      delivery: {
        include: {
          partograph: { orderBy: { recordedAt: "asc" } },
          newborns: { include: { patient: { select: PATIENT_SELECT } } },
        },
      },
    },
  });

  if (!pregnancy) return NextResponse.json({ error: "Pregnancy not found" }, { status: 404 });
  const access = session.user.tenantId ? await loadHivResultAccess(session, session.user.tenantId) : { canSee: true, confidentialCodes: new Set<string>() };
  return NextResponse.json({ ...pregnancy, examRequests: redactConfidentialExams(pregnancy.examRequests, access) });
}

// PATCH /api/v1/maternity/pregnancies/[id]
// Body: { status? (ongoing|miscarried|terminated), endedAt?, abortionCare? (uncomplicated|
// complicated), notes?, maternalDeath?: { at, cause, reviewedAt? } | null } — the end of a
// pregnancy without delivery, post-abortion care and maternal death (RMA3 II.1.2-012 to 024).
// "delivered" is only set by the delivery.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.pregnancy.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { lastMenstrualPeriod: true, status: true, delivery: { select: { deliveryDate: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Pregnancy not found" }, { status: 404 });

    const parsed = parsePregnancyOutcome(await req.json().catch(() => null), {
      lastMenstrualPeriod: existing.lastMenstrualPeriod,
      status: existing.status,
      hasDelivery: Boolean(existing.delivery?.deliveryDate),
    });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: parsed.error }, { status: 400 });
    const { maternalDeath, ...outcome } = parsed.value;

    const pregnancy = await prisma.pregnancy.update({
      where: { id },
      data: {
        ...outcome,
        ...(maternalDeath === undefined
          ? {}
          : maternalDeath === null
            ? { maternalDeathAt: null, maternalDeathCause: null, maternalDeathReviewedAt: null }
            : { maternalDeathAt: maternalDeath.at, maternalDeathCause: maternalDeath.cause, maternalDeathReviewedAt: maternalDeath.reviewedAt }),
      },
    });

    return NextResponse.json(pregnancy);
  } catch (error) {
    console.error("Error updating pregnancy:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
