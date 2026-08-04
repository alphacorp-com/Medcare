import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findSurgeryConflicts } from "@/lib/surgery/conflicts";
import type { SurgicalStatus } from "@prisma/client";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true } as const;

// ── GET /api/v1/surgeries ───────────────────────────────────────────────────
// Query params: status, surgeonId, from, to (ISO dates, filters on scheduledAt)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as SurgicalStatus | null;
  const surgeonId = searchParams.get("surgeonId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const surgeries = await prisma.surgicalProcedure.findMany({
    where: {
      status: status ?? undefined,
      surgeonId: surgeonId ?? undefined,
      scheduledAt:
        from || to
          ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined }
          : undefined,
    },
    include: { patient: { select: PATIENT_SELECT } },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(surgeries);
}

// ── POST /api/v1/surgeries ──────────────────────────────────────────────────
// Body: { patientId, stayId?, surgeonId, anesthesiologistId?, procedureLabel,
//         procedureCode?, roomId?, scheduledAt, asaScore?, force? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      patientId,
      stayId,
      surgeonId,
      anesthesiologistId,
      procedureLabel,
      procedureCode,
      roomId,
      scheduledAt,
      asaScore,
      force,
    } = body;

    if (!patientId || !surgeonId || !procedureLabel || !scheduledAt) {
      return NextResponse.json(
        { error: "patientId, surgeonId, procedureLabel and scheduledAt are required" },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);

    if (!force) {
      const conflicts = await findSurgeryConflicts({
        surgeonId,
        roomId: roomId || null,
        scheduledAt: scheduledDate,
      });
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Scheduling conflict", conflicts }, { status: 409 });
      }
    }

    const surgery = await prisma.surgicalProcedure.create({
      data: {
        patientId,
        stayId: stayId || null,
        surgeonId,
        anesthesiologistId: anesthesiologistId || null,
        procedureLabel,
        procedureCode: procedureCode || null,
        roomId: roomId || null,
        scheduledAt: scheduledDate,
        asaScore: asaScore ? Number(asaScore) : null,
        status: "scheduled",
      },
      include: { patient: { select: PATIENT_SELECT } },
    });

    return NextResponse.json(surgery, { status: 201 });
  } catch (error) {
    console.error("Error creating surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
