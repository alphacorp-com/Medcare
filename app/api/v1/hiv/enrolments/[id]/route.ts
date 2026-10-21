import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isUuid, parseStatusChange } from "@/lib/hiv/input";
import { auditHiv, hivBadRequest, hivNotFound, requireHivAccess } from "@/lib/hiv/route-auth";

// ── PATCH /api/v1/hiv/enrolments/:id ────────────────────────────────────────
// Body: { status: active|transferred_out|dead|stopped, statusChangedAt?, transferOut? }.
// A death is also recorded on the patient (isDeceased), as for the other death paths.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireHivAccess("update");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const { id } = await params;
    if (!isUuid(id)) return hivNotFound();
    const enrolment = await prisma.hivCareEnrolment.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!enrolment) return hivNotFound();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return hivBadRequest("invalid_body");
    const parsed = parseStatusChange(body as Record<string, unknown>);
    if (!parsed.ok) return hivBadRequest(parsed.error);
    if (parsed.value.statusChangedAt && parsed.value.statusChangedAt < enrolment.enrolledAt) return hivBadRequest("date_order");

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.value.status === "dead") {
        await tx.patient.updateMany({
          where: { id: enrolment.patientId, tenantId: access.tenantId, isDeceased: false },
          data: { isDeceased: true, deceasedAt: parsed.value.statusChangedAt },
        });
      }
      return tx.hivCareEnrolment.update({ where: { id: enrolment.id }, data: parsed.value });
    });
    await auditHiv(request, access, "hiv.enrolment.update", "hiv_care_enrolment", enrolment.id, enrolment.patientId);
    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/hiv/enrolments/:id]", error);
    return NextResponse.json({ error: "Failed to update the enrolment", success: false }, { status: 500 });
  }
}
