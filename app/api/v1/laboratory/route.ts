import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { listExams } from "@/lib/exams/exam-list";
import { parsePagination } from "@/lib/pagination";
import type { ExamUrgency } from "@prisma/client";
import { chargePrescribedExams, examNeedsPrepayment, isPaymentGateActive } from "@/lib/billing/paymentGate";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true, gender: true } as const;

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

  // Paged worklist: ?filter=<workflow state>|critical, ?search=, ?page=, ?pageSize=.
  // Returns { data, total, page, pageSize, counts } — counts feed the state tabs.
  const { searchParams } = new URL(req.url);
  try {
    const result = await listExams({
      tenantId: session.user.tenantId,
      domain: "laboratory",
      filter: searchParams.get("filter"),
      search: searchParams.get("search"),
      pagination: parsePagination(searchParams),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/v1/laboratory]", error);
    return NextResponse.json({ error: "Failed to load exams" }, { status: 500 });
  }
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

    const stay = stayId
      ? await prisma.stay.findFirst({
          where: { id: stayId, tenantId: session.user.tenantId, patientId },
          select: { id: true, type: true, triageAcuity: true },
        })
      : null;
    if (stayId && !stay) {
      return NextResponse.json({ error: "Stay not found" }, { status: 404 });
    }
    const resolvedUrgency = urgency ?? "routine";
    const gateActive = await isPaymentGateActive(session.user.tenantId);

    const exam = await prisma.examRequest.create({
      data: {
        tenantId: session.user.tenantId,
        patientId,
        stayId: stay?.id ?? null,
        pregnancyId: pregnancyId || null,
        prescriberId: session.user.id,
        type: "biology",
        examCode: panel?.code ?? `EX-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
        examLabel: panel?.nameFr ?? examLabel!.trim(),
        urgency: resolvedUrgency,
        status: examNeedsPrepayment(gateActive, stay, resolvedUrgency) ? "awaiting_payment" : "requested",
        notes: notes || null,
      },
      include: { patient: { select: PATIENT_SELECT }, results: true },
    });

    // Billed at prescription; stays "awaiting_payment" until the patient pays.
    const billing = await chargePrescribedExams({
      tenantId: session.user.tenantId,
      patientId,
      stayId: exam.stayId,
      performedById: session.user.id,
      exams: [exam],
    });
    const current = await prisma.examRequest.findUnique({
      where: { id: exam.id },
      include: { patient: { select: PATIENT_SELECT }, results: true },
    });

    return NextResponse.json({ ...(current ?? exam), billing }, { status: 201 });
  } catch (error) {
    console.error("Error creating lab exam:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
