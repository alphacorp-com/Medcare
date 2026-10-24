import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEpiAccess } from "@/lib/epi/route-auth";
import { parseTbScreening } from "@/lib/programs/input-complements";
import { PATIENT_REF, programError } from "@/lib/programs/route-helpers";

// PATCH /api/v1/tb-screenings/[id] — the follow-up of a screening (presumptive, lab, result,
// preventive treatment). The whole screening is validated again with the stored values.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireEpiAccess("update");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const current = await prisma.tbScreening.findFirst({ where: { id, tenantId: guard.tenantId } });
  if (!current) return programError("not_found", 404);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return programError("invalid_body");
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const merged = {
    patientId: current.patientId,
    screenedAt: current.screenedAt.toISOString(),
    presumptive: current.presumptive,
    sentToLabAt: iso(current.sentToLabAt),
    testedAt: iso(current.testedAt),
    testPositive: current.testPositive,
    tptStartedAt: iso(current.tptStartedAt),
    notes: current.notes,
    ...body,
  };
  const parsed = parseTbScreening(merged);
  if (!parsed.ok) return programError(parsed.error);
  const { patientId: _patientId, ...data } = parsed.value;
  void _patientId;
  const updated = await prisma.tbScreening.update({ where: { id }, data, include: { patient: PATIENT_REF } });
  return NextResponse.json({ data: updated });
}
