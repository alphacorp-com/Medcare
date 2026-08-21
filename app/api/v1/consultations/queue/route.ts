import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// ── GET /api/v1/consultations/queue ─────────────────────────────────────────
// Every in-progress stay not yet completed by a doctor, sorted most-urgent-first:
// triage acuity ascending (untriaged/scheduled stays sort last, per TriageAcuity's
// declaration order), then time since triage (or admission, for stays never triaged)
// ascending — oldest wait first within the same acuity bucket.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_ADMISSION", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const stays = await prisma.stay.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "in_progress",
        consultationStatus: { in: ["waiting", "claimed"] },
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, ipp: true },
        },
      },
      orderBy: [
        { triageAcuity: { sort: "asc", nulls: "last" } },
        { triagedAt: { sort: "asc", nulls: "last" } },
        { admissionDate: "asc" },
      ],
      take: 100,
    });

    const doctorIds = Array.from(
      new Set(stays.map((stay) => stay.attendingDoctorId).filter((id): id is string => Boolean(id)))
    );
    const doctors = doctorIds.length
      ? await prisma.tenantUser.findMany({
          where: { id: { in: doctorIds }, tenantId: session.user.tenantId },
          select: { id: true, fullName: true },
        })
      : [];
    const doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));

    const now = Date.now();
    const queue = stays.map((stay) => {
      const waitSince = stay.triagedAt ?? stay.admissionDate;
      return {
        id: stay.id,
        patientId: stay.patientId,
        ipp: stay.patient.ipp,
        name: `${stay.patient.lastName} ${stay.patient.firstName}`,
        type: stay.type,
        triageAcuity: stay.triageAcuity,
        consultationStatus: stay.consultationStatus,
        waitingMinutes: Math.floor((now - waitSince.getTime()) / (1000 * 60)),
        // Only meaningful once actually claimed through this queue — a pre-existing
        // attendingDoctorId from before this feature (or set manually at admission) does
        // not by itself mean the patient has been "received," so it's ignored here.
        claimedBy:
          stay.consultationStatus === "claimed" && stay.attendingDoctorId && doctorsById.has(stay.attendingDoctorId)
            ? { id: stay.attendingDoctorId, fullName: doctorsById.get(stay.attendingDoctorId)!.fullName }
            : null,
        isMine: stay.consultationStatus === "claimed" && stay.attendingDoctorId === session.user.id,
      };
    });

    return NextResponse.json({ data: queue, total: queue.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/consultations/queue]", error);
    return NextResponse.json({ error: "Failed to fetch consultation queue", success: false }, { status: 500 });
  }
}
