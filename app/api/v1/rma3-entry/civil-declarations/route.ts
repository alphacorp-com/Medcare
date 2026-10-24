import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { monthRange } from "@/lib/epi/route-auth";
import { parseCivilDeclaration } from "@/lib/programs/input-complements";
import { auditRma3, badRequest, errorResponse, requireRma3Access } from "@/lib/rma3-manual/route-auth";

// GET /api/v1/rma3-entry/civil-declarations?month=YYYY-MM — birth / death declarations
// transmitted to the civil registry in a month (RMA3 V.2), MODULE_RMA3.
export async function GET(request: Request) {
  try {
    const guard = await requireRma3Access("read");
    if (!guard.ok) return guard.response;
    const range = monthRange(new URL(request.url).searchParams.get("month"));
    if (!range) return badRequest("invalid_month");
    const declarations = await prisma.civilRegistrationDeclaration.findMany({
      where: { tenantId: guard.access.tenantId, transmittedAt: { gte: range.start, lt: range.end } },
      orderBy: { transmittedAt: "desc" },
    });
    return NextResponse.json({ data: declarations });
  } catch (error) {
    return errorResponse(error, "GET civil declarations");
  }
}

// POST /api/v1/rma3-entry/civil-declarations
// Body: { type (birth|death), patientId?, personName, eventDate, transmittedAt?, reference? }
export async function POST(request: Request) {
  try {
    const guard = await requireRma3Access("update");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const parsed = parseCivilDeclaration(await request.json().catch(() => null));
    if (!parsed.ok) return badRequest(parsed.error);
    if (parsed.value.patientId) {
      const patient = await prisma.patient.findFirst({ where: { id: parsed.value.patientId, tenantId: access.tenantId }, select: { id: true } });
      if (!patient) return badRequest("invalid_patient");
    }
    const declaration = await prisma.civilRegistrationDeclaration.create({ data: { ...parsed.value, tenantId: access.tenantId, recordedById: access.userId } });
    await auditRma3(request, access, "rma3.civil_declaration_create", declaration.id, { type: declaration.type });
    return NextResponse.json({ data: declaration }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "POST civil declaration");
  }
}
