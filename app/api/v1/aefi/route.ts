import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { parseAefiInput } from "@/lib/epi/input";
import { badRequest, monthRange, requireEpiAccess } from "@/lib/epi/route-auth";

// ── GET /api/v1/aefi?month=YYYY-MM ──────────────────────────────────────────
// AEFI (MAPI) reports whose onset is in the month, with the dose and the patient.
export async function GET(request: Request) {
  try {
    const access = await requireEpiAccess("read");
    if (!access.ok) return access.response;
    const range = monthRange(new URL(request.url).searchParams.get("month"));
    if (!range) return badRequest("invalid_month");

    const reports = await prisma.aefiReport.findMany({
      where: { tenantId: access.tenantId, onsetAt: { gte: range.start, lt: range.end } },
      orderBy: { onsetAt: "desc" },
      include: {
        immunization: {
          select: {
            antigenName: true,
            doseNumber: true,
            administeredAt: true,
            lotNumber: true,
            patient: { select: { id: true, firstName: true, lastName: true, ipp: true } },
          },
        },
      },
    });
    return NextResponse.json({ data: reports, success: true });
  } catch (error) {
    console.error("[GET /api/v1/aefi]", error);
    return NextResponse.json({ error: "Failed to fetch AEFI reports", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/aefi ───────────────────────────────────────────────────────
// Body: { immunizationId, onsetAt (ISO), seriousness: minor|serious, outcome?, hospitalized?,
//         description }. The dose must be one of this facility's and precede the onset; the
// patient is the dose's (never taken from the browser).
export async function POST(request: Request) {
  try {
    const access = await requireEpiAccess("create");
    if (!access.ok) return access.response;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("invalid_body");
    const parsed = parseAefiInput(body as Record<string, unknown>);
    if (!parsed.ok) return badRequest(parsed.error);

    const dose = await prisma.immunization.findFirst({
      where: { id: parsed.value.immunizationId, tenantId: access.tenantId },
      select: { id: true, patientId: true, administeredAt: true, antigenName: true },
    });
    if (!dose) return badRequest("invalid_immunization");
    // Same calendar day is accepted: the dose time is often only a date.
    const doseDay = Date.UTC(dose.administeredAt.getUTCFullYear(), dose.administeredAt.getUTCMonth(), dose.administeredAt.getUTCDate());
    if (parsed.value.onsetAt.getTime() < doseDay) return badRequest("onset_before_dose");

    const report = await prisma.aefiReport.create({
      data: { tenantId: access.tenantId, patientId: dose.patientId, reportedById: access.userId, ...parsed.value },
    });
    await recordAuditEvent({
      tenantId: access.tenantId,
      actorId: access.userId,
      actorType: "tenant_user",
      action: "aefi.create",
      resourceType: "aefi_report",
      resourceId: report.id,
      payload: { antigen: dose.antigenName, seriousness: report.seriousness },
      ...extractRequestMeta(request.headers),
    });
    return NextResponse.json({ data: report, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/aefi]", error);
    return NextResponse.json({ error: "Failed to record the AEFI", success: false }, { status: 500 });
  }
}
