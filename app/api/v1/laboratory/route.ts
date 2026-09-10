import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import type { ExamRequestStatus, ExamUrgency } from "@prisma/client";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true } as const;

// ── GET /api/v1/laboratory ──────────────────────────────────────────────────
// Query params: status, urgency, critical ("true"), search (patient name/ipp/examLabel)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_LAB", "read");
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
      tenantId: session.user.tenantId,
      type: "biology",
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

// ── POST /api/v1/laboratory ─────────────────────────────────────────────────
// Body: { patientId, stayId?, panelCode, examLabel? (required when panelCode is CUSTOM),
//         urgency?, notes? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_LAB", "create");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const body = await req.json();
    const { patientId, stayId, pregnancyId, panelCode, examLabel, urgency, notes } = body as {
      patientId?: string;
      stayId?: string;
      pregnancyId?: string;
      panelCode?: string;
      examLabel?: string;
      urgency?: ExamUrgency;
      notes?: string;
    };

    if (!patientId || !panelCode) {
      return NextResponse.json({ error: "patientId and panelCode are required" }, { status: 400 });
    }

    const panel = await prisma.examCatalogEntry.findFirst({
      where: { tenantId: session.user.tenantId, code: panelCode, examType: { domain: "laboratory" } },
    });
    if (!panel && !examLabel?.trim()) {
      return NextResponse.json({ error: "examLabel is required for a custom panel" }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const exam = await prisma.examRequest.create({
      data: {
        tenantId: session.user.tenantId,
        patientId,
        stayId: stayId || null,
        pregnancyId: pregnancyId || null,
        prescriberId: session.user.id,
        type: "biology",
        examCode: panel?.code ?? `EX-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
        examLabel: panel?.nameFr ?? examLabel!.trim(),
        urgency: urgency ?? "routine",
        notes: notes || null,
      },
      include: { patient: { select: PATIENT_SELECT }, results: true },
    });

    return NextResponse.json(exam, { status: 201 });
  } catch (error) {
    console.error("Error creating lab exam:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
