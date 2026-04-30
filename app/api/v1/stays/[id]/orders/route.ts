import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { ExamType, ExamUrgency } from "@prisma/client";

// ── POST /api/v1/stays/:id/orders ───────────────────────────────────────────
// Body: { prescriberId, type, examCode?, examLabel, urgency?, notes? }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stayId } = await params;
    const body = await request.json();

    let {
      prescriberId,
      type,
      examCode,
      examLabel,
      urgency = "routine",
      notes,
    } = body;

    if (!prescriberId || !type || !examLabel) {
      return NextResponse.json(
        { error: "prescriberId, type, and examLabel are required", success: false },
        { status: 400 }
      );
    }

    // Generate examCode if not provided
    if (!examCode) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      examCode = `EX-${timestamp}-${random}`;
    }

    // Fetch the stay to get patientId
    const stay = await prisma.stay.findUnique({
      where: { id: stayId },
      select: { id: true, patientId: true },
    });

    if (!stay) {
      return NextResponse.json(
        { error: "Stay not found", success: false },
        { status: 404 }
      );
    }

    const order = await prisma.examRequest.create({
      data: {
        patientId: stay.patientId,
        stayId: stay.id,
        prescriberId,
        type: type as ExamType,
        examCode,
        examLabel,
        urgency: urgency as ExamUrgency,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ data: order, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/stays/:id/orders]", error);
    return NextResponse.json(
      { error: "Failed to create medical order", success: false },
      { status: 500 }
    );
  }
}

// ── GET /api/v1/stays/:id/orders ─────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stayId } = await params;

    const orders = await prisma.examRequest.findMany({
      where: { stayId },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({ data: orders, success: true });
  } catch (error) {
    console.error("[GET /api/v1/stays/:id/orders]", error);
    return NextResponse.json(
      { error: "Failed to fetch orders", success: false },
      { status: 500 }
    );
  }
}
