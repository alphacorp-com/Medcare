import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parseFpVisit } from "@/lib/maternity/input";
import { monthRange } from "@/lib/epi/route-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATIENT = { select: { id: true, firstName: true, lastName: true, ipp: true, gender: true, birthDate: true } } as const;

async function guard(action: "read" | "create") {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", action);
  if (!permCheck.ok) return { ok: false as const, response: NextResponse.json({ error: permCheck.error }, { status: permCheck.status }) };
  const tenantId = session.user.tenantId;
  if (!tenantId) return { ok: false as const, response: NextResponse.json({ error: "A facility account is required" }, { status: 403 }) };
  return { ok: true as const, tenantId, userId: session.user.id };
}

// GET /api/v1/family-planning/visits?month=YYYY-MM  — the register of a month
// GET /api/v1/family-planning/visits?patientId=…    — the FP history of a patient
// Family planning belongs to the maternity module (MODULE_MATERNITY) but is attached to the
// patient, never to a pregnancy: women without antenatal care and men are followed too.
export async function GET(request: Request) {
  const access = await guard("read");
  if (!access.ok) return access.response;
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  try {
    if (patientId) {
      if (!UUID.test(patientId)) return NextResponse.json({ error: "invalid_patient", code: "invalid_patient" }, { status: 400 });
      const visits = await prisma.familyPlanningVisit.findMany({
        where: { tenantId: access.tenantId, patientId },
        orderBy: { visitDate: "desc" },
        take: 200,
      });
      return NextResponse.json({ data: visits });
    }
    const range = monthRange(searchParams.get("month"));
    if (!range) return NextResponse.json({ error: "invalid_month", code: "invalid_month" }, { status: 400 });
    const visits = await prisma.familyPlanningVisit.findMany({
      where: { tenantId: access.tenantId, visitDate: { gte: range.start, lt: range.end } },
      orderBy: { visitDate: "desc" },
      include: { patient: PATIENT },
      take: 1000,
    });
    return NextResponse.json({ data: visits });
  } catch (error) {
    console.error("[GET /api/v1/family-planning/visits]", error);
    return NextResponse.json({ error: "Failed to load the family planning visits" }, { status: 500 });
  }
}

// POST /api/v1/family-planning/visits
// Body: { patientId, visitDate?, clientStatus (new_user|continuing_user), counseled?,
//         methodCode? (lib/family-planning/methods), procedure?, isPostpartum?, referredByChw?,
//         contraindications?, sideEffects?, nextDueDate? (YYYY-MM-DD), notes? }
export async function POST(request: Request) {
  const access = await guard("create");
  if (!access.ok) return access.response;
  try {
    const body = await request.json().catch(() => null);
    const patientId = (body as { patientId?: unknown } | null)?.patientId;
    const patient =
      typeof patientId === "string" && UUID.test(patientId)
        ? await prisma.patient.findFirst({ where: { id: patientId, tenantId: access.tenantId }, select: { id: true, gender: true } })
        : null;
    if (!patient) return NextResponse.json({ error: "invalid_patient", code: "invalid_patient" }, { status: 400 });

    const parsed = parseFpVisit(body, patient.gender);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: parsed.error }, { status: 400 });

    const visit = await prisma.familyPlanningVisit.create({
      data: { ...parsed.value, tenantId: access.tenantId, performedById: access.userId },
      include: { patient: PATIENT },
    });
    return NextResponse.json({ data: visit }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/family-planning/visits]", error);
    return NextResponse.json({ error: "Failed to record the family planning visit" }, { status: 500 });
  }
}
