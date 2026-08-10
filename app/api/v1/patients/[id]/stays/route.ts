import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { StayStatus, StayType } from "@prisma/client";

// Only accept valid UUIDs for FK fields; treat anything else as null
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toUuid = (v: unknown): string | null =>
  typeof v === "string" && UUID_RE.test(v) ? v : null;

const toNumber = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const hasAnyVital = (v: Record<string, unknown> | undefined | null): boolean =>
  Boolean(v) && ["bloodPressureSystolic", "bloodPressureDiastolic", "pulse", "temperature", "weight", "height", "spo2"]
    .some((key) => toNumber(v![key]) !== null);

const STAY_STATUSES: StayStatus[] = [
  "pre_admission",
  "in_progress",
  "discharged",
  "transferred",
  "deceased",
];

// ── GET /api/v1/patients/:id/stays ────────────────────────────────────────────
// Query params:
//   status – optional StayStatus filter (pre_admission | in_progress | discharged | transferred | deceased)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as StayStatus | null;

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found", success: false },
        { status: 404 }
      );
    }

    const stays = await prisma.stay.findMany({
      where: {
        patientId: id,
        tenantId: session.user.tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { admissionDate: "desc" },
    });

    return NextResponse.json({ data: stays, total: stays.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/stays]", error);
    return NextResponse.json(
      { error: "Failed to fetch stays", success: false },
      { status: 500 }
    );
  }
}

// ── POST /api/v1/patients/:id/stays ───────────────────────────────────────────
// Body (all Stay model writable fields):
//   type*         – StayType (emergency | scheduled | day_care | outpatient)
//   status        – StayStatus (default: in_progress)
//   admissionDate – ISO datetime (default: now)
//   admissionReason
//   dischargeDate – ISO datetime
//   dischargeSummary
//   pmsiCode
//   pmsiValidated  – boolean (default false)
//   departmentId   – UUID
//   bedId          – UUID
//   attendingDoctorId – UUID
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      type,
      status,
      admissionDate,
      admissionReason,
      dischargeDate,
      dischargeSummary,
      pmsiCode,
      pmsiValidated,
      departmentId,
      bedId,
      attendingDoctorId,
      vitals,
    } = body;

    // ── Validate required fields ───────────────────────────────────────────
    if (!type) {
      return NextResponse.json(
        { error: "type is required", success: false },
        { status: 400 }
      );
    }

    // Validate status enum if provided
    const resolvedStatus: StayStatus =
      status && STAY_STATUSES.includes(status as StayStatus)
        ? (status as StayStatus)
        : "in_progress";

    // ── Verify parent patient belongs to this tenant ────────────────────────
    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found", success: false },
        { status: 404 }
      );
    }

    // ── Resolve + validate the bed, if one was chosen ───────────────────────
    let resolvedBedId = toUuid(bedId);
    let resolvedDepartmentId = toUuid(departmentId);
    if (resolvedBedId) {
      const bed = await prisma.bed.findFirst({
        where: { id: resolvedBedId, tenantId: session.user.tenantId },
      });
      if (!bed) {
        return NextResponse.json({ error: "Bed not found", success: false }, { status: 404 });
      }
      if (resolvedDepartmentId && resolvedDepartmentId !== bed.departmentId) {
        return NextResponse.json(
          { error: "Bed does not belong to the selected department", success: false },
          { status: 409 }
        );
      }
      if (bed.status !== "available") {
        return NextResponse.json({ error: "Bed is not available", success: false }, { status: 409 });
      }
      resolvedDepartmentId = resolvedDepartmentId ?? bed.departmentId;
    }

    // ── Generate stay number (scoped to tenant since Stay.stayNumber is
    // unique per-tenant, not globally) ──────────────────────────────────────
    const count = await prisma.stay.count({
      where: { tenantId: session.user.tenantId },
    });
    const stayNumber = `STAY${String(count + 1).padStart(6, "0")}`;

    // ── Create (and, if a bed was chosen, occupy it atomically — the guarded
    // updateMany only succeeds if the bed is still available, closing the race
    // where two admissions target the same bed at once) ────────────────────
    const stay = await prisma.$transaction(async (tx) => {
      const created = await tx.stay.create({
        data: {
          tenantId: session.user.tenantId,
          patientId: id,
          stayNumber,
          type: type as StayType,
          status: resolvedStatus,
          admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
          admissionReason: admissionReason || null,
          dischargeDate: dischargeDate ? new Date(dischargeDate) : null,
          dischargeSummary: dischargeSummary || null,
          pmsiCode: pmsiCode || null,
          pmsiValidated: typeof pmsiValidated === "boolean" ? pmsiValidated : false,
          departmentId: resolvedDepartmentId,
          bedId: resolvedBedId,
          attendingDoctorId: toUuid(attendingDoctorId),
          ...(hasAnyVital(vitals)
            ? {
                vitalSigns: {
                  create: {
                    tenantId: session.user.tenantId,
                    patientId: id,
                    recordedById: session.user.id,
                    bloodPressureSystolic: toNumber(vitals.bloodPressureSystolic),
                    bloodPressureDiastolic: toNumber(vitals.bloodPressureDiastolic),
                    pulse: toNumber(vitals.pulse),
                    temperature: toNumber(vitals.temperature),
                    weight: toNumber(vitals.weight),
                    height: toNumber(vitals.height),
                    spo2: toNumber(vitals.spo2),
                  },
                },
              }
            : {}),
        },
      });

      if (resolvedBedId) {
        const occupied = await tx.bed.updateMany({
          where: { id: resolvedBedId, tenantId: session.user.tenantId, status: "available" },
          data: { status: "occupied", currentStayId: created.id },
        });
        if (occupied.count !== 1) {
          throw new Error("BED_CONFLICT");
        }
      }

      return created;
    });

    return NextResponse.json({ data: stay, success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "BED_CONFLICT") {
      return NextResponse.json({ error: "Bed was just taken by another admission", success: false }, { status: 409 });
    }
    console.error("[POST /api/v1/patients/:id/stays]", error);
    return NextResponse.json(
      { error: "Failed to create stay", success: false },
      { status: 500 }
    );
  }
}
