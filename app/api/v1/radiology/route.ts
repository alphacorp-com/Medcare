import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findExam, generateExamCode } from "@/lib/radiology/catalog";
import { requireModulePermission } from "@/lib/permissions";
import type { ExamRequestStatus, ExamUrgency } from "@prisma/client";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true, allergies: true } as const;

// ── GET /api/v1/radiology ───────────────────────────────────────────────────
// Query params: status, urgency, critical ("true"), search (patient name/ipp/examLabel)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_RADIOLOGY", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ExamRequestStatus | null;
  const urgency = searchParams.get("urgency") as ExamUrgency | null;
  const critical = searchParams.get("critical") === "true";
  const search = searchParams.get("search")?.trim();

  const exams = await prisma.examRequest.findMany({
    where: {
      type: "radiology",
      status: status ?? undefined,
      urgency: urgency ?? undefined,
      results: critical ? { some: { isCritical: true } } : undefined,
      ...(search
        ? {
            OR: [
              { examLabel: { contains: search, mode: "insensitive" } },
              { patient: { firstName: { contains: search, mode: "insensitive" } } },
              { patient: { lastName: { contains: search, mode: "insensitive" } } },
              { patient: { ipp: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      patient: { select: PATIENT_SELECT },
      results: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json(exams);
}

// ── POST /api/v1/radiology ──────────────────────────────────────────────────
// Body: { patientId, stayId?, examCode, examLabel? (required when examCode is CUSTOM), urgency?, notes? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_RADIOLOGY", "create");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const body = await req.json();
    const { patientId, stayId, examCode, examLabel, urgency, notes } = body as {
      patientId?: string;
      stayId?: string;
      examCode?: string;
      examLabel?: string;
      urgency?: ExamUrgency;
      notes?: string;
    };

    if (!patientId || !examCode) {
      return NextResponse.json({ error: "patientId and examCode are required" }, { status: 400 });
    }

    const catalogEntry = findExam(examCode);
    if (!catalogEntry && !examLabel?.trim()) {
      return NextResponse.json({ error: "examLabel is required for a custom exam" }, { status: 400 });
    }

    const exam = await prisma.examRequest.create({
      data: {
        patientId,
        stayId: stayId || null,
        prescriberId: session.user.id,
        type: "radiology",
        examCode: catalogEntry?.code ?? generateExamCode(),
        examLabel: catalogEntry?.label ?? examLabel!.trim(),
        urgency: urgency ?? "routine",
        notes: notes || null,
      },
      include: { patient: { select: PATIENT_SELECT }, results: true },
    });

    return NextResponse.json(exam, { status: 201 });
  } catch (error) {
    console.error("Error creating radiology exam:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
