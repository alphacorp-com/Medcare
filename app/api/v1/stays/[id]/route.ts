import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { StayStatus, TriageAcuity } from "@prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toUuid = (v: unknown): string | null =>
  typeof v === "string" && UUID_RE.test(v) ? v : null;

const TERMINAL_STATUSES: StayStatus[] = ["discharged", "transferred", "deceased"];

const TRIAGE_ACUITIES: TriageAcuity[] = [
  "resuscitation",
  "emergent",
  "urgent",
  "less_urgent",
  "non_urgent",
];

// ── GET /api/v1/stays/:id ───────────────────────────────────────────────────
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

    const stay = await prisma.stay.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            ipp: true,
            birthDate: true,
          },
        },
        medicalRecords: {
          orderBy: { createdAt: "desc" },
        },
        prescriptions: {
          orderBy: { prescribedAt: "desc" },
        },
        examRequests: {
          orderBy: { requestedAt: "desc" },
        },
      },
    });

    if (!stay) {
      return NextResponse.json(
        { error: "Stay not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: stay, success: true });
  } catch (error) {
    console.error("[GET /api/v1/stays/:id]", error);
    return NextResponse.json(
      { error: "Failed to fetch stay", success: false },
      { status: 500 }
    );
  }
}

// ── PATCH /api/v1/stays/:id ─────────────────────────────────────────────────
// Body: { status?, dischargeDate?, dischargeSummary?, bedId?, departmentId?, attendingDoctorId? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      status,
      dischargeDate,
      dischargeSummary,
      bedId,
      departmentId,
      attendingDoctorId,
      triageAcuity,
    } = body;

    if (triageAcuity !== undefined && triageAcuity !== null && !TRIAGE_ACUITIES.includes(triageAcuity as TriageAcuity)) {
      return NextResponse.json({ error: "Invalid triageAcuity", success: false }, { status: 400 });
    }

    const existingStay = await prisma.stay.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true, bedId: true, departmentId: true, status: true, triagedAt: true },
    });

    if (!existingStay) {
      return NextResponse.json(
        { error: "Stay not found", success: false },
        { status: 404 }
      );
    }

    // ── Resolve the target bed/department and whether the currently-assigned
    // bed needs to be released (bed changed, or the stay is ending) ─────────
    const newStatus: StayStatus = status !== undefined ? status : existingStay.status;
    const bedProvided = bedId !== undefined;
    const isEnding = TERMINAL_STATUSES.includes(newStatus);
    let newBedId = bedProvided ? toUuid(bedId) : existingStay.bedId;
    if (isEnding) newBedId = null;
    const resolvedDepartmentId = departmentId !== undefined ? toUuid(departmentId) : existingStay.departmentId;

    const bedChanged = newBedId !== existingStay.bedId;

    if (newBedId) {
      const bed = await prisma.bed.findFirst({
        where: { id: newBedId, tenantId: session.user.tenantId },
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
      if (bedChanged && bed.status !== "available") {
        return NextResponse.json({ error: "Bed is not available", success: false }, { status: 409 });
      }
    }

    const stay = await prisma.$transaction(async (tx) => {
      const updated = await tx.stay.update({
        where: { id },
        data: {
          ...(status !== undefined && { status }),
          ...(dischargeDate !== undefined && { dischargeDate: dischargeDate ? new Date(dischargeDate) : null }),
          ...(dischargeSummary !== undefined && { dischargeSummary }),
          ...((bedProvided || isEnding) && { bedId: newBedId }),
          ...(departmentId !== undefined && { departmentId: resolvedDepartmentId }),
          ...(attendingDoctorId !== undefined && { attendingDoctorId }),
          ...(triageAcuity !== undefined && { triageAcuity }),
          // Marks the start of the wait-for-doctor clock the first time acuity is known —
          // a later re-triage adjusts the acuity but must not reset this timestamp.
          ...(triageAcuity && !existingStay.triagedAt && { triagedAt: new Date() }),
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ipp: true,
            },
          },
        },
      });

      if (bedChanged) {
        if (existingStay.bedId) {
          await tx.bed.updateMany({
            where: { id: existingStay.bedId, tenantId: session.user.tenantId, currentStayId: id },
            data: { status: "available", currentStayId: null },
          });
        }
        if (newBedId) {
          const occupied = await tx.bed.updateMany({
            where: { id: newBedId, tenantId: session.user.tenantId, status: "available" },
            data: { status: "occupied", currentStayId: id },
          });
          if (occupied.count !== 1) {
            throw new Error("BED_CONFLICT");
          }
        }
      }

      return updated;
    });

    return NextResponse.json({ data: stay, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "BED_CONFLICT") {
      return NextResponse.json({ error: "Bed was just taken by another admission", success: false }, { status: 409 });
    }
    console.error("[PATCH /api/v1/stays/:id]", error);
    return NextResponse.json(
      { error: "Failed to update stay", success: false },
      { status: 500 }
    );
  }
}
