import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { StayStatus, TriageAcuity } from "@prisma/client";
import { isVitalEmergency } from "@/lib/billing/paymentGate";

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
            gender: true,
            bloodGroup: true,
            allergies: true,
            chronicConditions: true,
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
          include: { results: { orderBy: { createdAt: "desc" }, take: 1 } },
        },
        vitalSigns: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!stay) {
      return NextResponse.json(
        { error: "Stay not found", success: false },
        { status: 404 }
      );
    }

    const tenantId = session.user.tenantId;
    const [medicalAct, hospitalizationAct, hospitalizationBed, hospitalizationDepartment, authors] = await Promise.all([
      stay.medicalActCode
        ? prisma.medicalAct.findFirst({ where: { tenantId, code: stay.medicalActCode }, select: { code: true, nameFr: true, basePrice: true } })
        : null,
      stay.hospitalizationActCode
        ? prisma.medicalAct.findFirst({ where: { tenantId, code: stay.hospitalizationActCode }, select: { nameFr: true } })
        : null,
      stay.hospitalizationBedId
        ? prisma.bed.findFirst({ where: { tenantId, id: stay.hospitalizationBedId }, select: { code: true, label: true } })
        : null,
      stay.hospitalizationDepartmentId
        ? prisma.department.findFirst({ where: { tenantId, id: stay.hospitalizationDepartmentId }, select: { name: true } })
        : null,
      // Names for whoever wrote notes, prescribed, or performed/validated exams on this stay.
      prisma.tenantUser.findMany({
        where: {
          tenantId,
          id: {
            in: Array.from(new Set([
              ...stay.medicalRecords.map((record) => record.authorId),
              ...stay.prescriptions.map((rx) => rx.prescriberId),
              ...stay.examRequests.flatMap((exam) => [exam.prescriberId, exam.results[0]?.performerId, exam.results[0]?.validatedBy]),
              stay.attendingDoctorId,
            ].filter((userId): userId is string => Boolean(userId)))),
          },
        },
        select: { id: true, fullName: true },
      }),
    ]);

    return NextResponse.json({
      data: {
        ...stay,
        medicalAct: medicalAct ? { code: medicalAct.code, label: medicalAct.nameFr, price: Number(medicalAct.basePrice) } : null,
        hospitalization: stay.hospitalizationStatus
          ? {
              status: stay.hospitalizationStatus,
              actLabel: hospitalizationAct?.nameFr ?? stay.hospitalizationActCode,
              bedLabel: hospitalizationBed?.label ?? null,
              departmentName: hospitalizationDepartment?.name ?? null,
              requestedAt: stay.hospitalizationRequestedAt,
              hospitalizedAt: stay.hospitalizedAt,
            }
          : null,
        userNames: Object.fromEntries(authors.map((user) => [user.id, user.fullName])),
      },
      success: true,
    });
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
      select: {
        id: true, bedId: true, departmentId: true, status: true, triagedAt: true, type: true, consultationStatus: true,
        hospitalizationStatus: true, hospitalizationBedId: true,
      },
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

    // A patient re-triaged as a vital emergency while still waiting at the cashier goes
    // straight to the doctor — payment is collected afterwards (lib/billing/paymentGate.ts).
    const releaseForEmergency =
      existingStay.consultationStatus === "awaiting_payment" &&
      triageAcuity &&
      isVitalEmergency({ type: existingStay.type, triageAcuity: triageAcuity as TriageAcuity });

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
          ...(releaseForEmergency && { consultationStatus: "waiting" }),
          // Leaving before the hospitalisation was paid: drop the pending request.
          ...(isEnding && existingStay.hospitalizationStatus === "awaiting_payment" && {
            hospitalizationStatus: null,
            hospitalizationBedId: null,
            hospitalizationDepartmentId: null,
          }),
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

      if (isEnding && existingStay.hospitalizationStatus === "awaiting_payment" && existingStay.hospitalizationBedId) {
        await tx.bed.updateMany({
          where: { id: existingStay.hospitalizationBedId, currentStayId: id, status: "reserved" },
          data: { status: "available", currentStayId: null },
        });
      }

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
