import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { ExamType, ExamUrgency } from "@prisma/client";

type OrderSource = "laboratory" | "radiology" | "medical_act";

interface OrderItemInput {
  source: OrderSource;
  code: string;
  urgency?: ExamUrgency;
}

const SOURCE_TO_TYPE: Record<OrderSource, ExamType> = {
  laboratory: "biology",
  radiology: "radiology",
  medical_act: "other",
};

// ── POST /api/v1/stays/:id/orders ───────────────────────────────────────────
// Body: { prescriberId, notes?, items: [{ source: "laboratory" | "radiology" | "medical_act", code, urgency? }] }
// Every order must resolve to an already-configured, priced catalog entry (ExamCatalogEntry
// for labo/radio, MedicalAct for everything else) — no free-text exam label accepted, so the
// examCode this stores always matches a real code a FeeSchedule entry can be billed against.
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

    const { id: stayId } = await params;
    const body = await request.json();
    const { prescriberId, notes, items } = body as {
      prescriberId?: string;
      notes?: string;
      items?: OrderItemInput[];
    };

    if (!prescriberId) {
      return NextResponse.json(
        { error: "prescriberId is required", success: false },
        { status: 400 }
      );
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one order item is required", success: false },
        { status: 400 }
      );
    }

    const stay = await prisma.stay.findFirst({
      where: { id: stayId, tenantId: session.user.tenantId },
      select: { id: true, patientId: true },
    });
    if (!stay) {
      return NextResponse.json(
        { error: "Stay not found", success: false },
        { status: 404 }
      );
    }

    // Resolve each item against its catalog before creating anything — an unresolved
    // code fails the whole batch rather than silently falling back to a made-up label.
    const resolved: { type: ExamType; examCode: string; examLabel: string; urgency: ExamUrgency }[] = [];
    for (const item of items) {
      if (!item.source || !item.code || !(item.source in SOURCE_TO_TYPE)) {
        return NextResponse.json(
          { error: "Each item requires a valid source and code", success: false },
          { status: 400 }
        );
      }

      if (item.source === "medical_act") {
        const act = await prisma.medicalAct.findFirst({
          where: { tenantId: session.user.tenantId, code: item.code, isActive: true },
        });
        if (!act) {
          return NextResponse.json(
            { error: `Medical act "${item.code}" was not found or is inactive`, success: false },
            { status: 404 }
          );
        }
        resolved.push({ type: "other", examCode: act.code, examLabel: act.nameFr, urgency: item.urgency ?? "routine" });
      } else {
        const entry = await prisma.examCatalogEntry.findFirst({
          where: {
            tenantId: session.user.tenantId,
            code: item.code,
            isActive: true,
            examType: { domain: item.source, isActive: true },
          },
        });
        if (!entry) {
          return NextResponse.json(
            { error: `Catalog entry "${item.code}" was not found or is inactive`, success: false },
            { status: 404 }
          );
        }
        resolved.push({
          type: SOURCE_TO_TYPE[item.source],
          examCode: entry.code,
          examLabel: entry.nameFr,
          urgency: item.urgency ?? "routine",
        });
      }
    }

    const orders = await prisma.$transaction(
      resolved.map((item) =>
        prisma.examRequest.create({
          data: {
            tenantId: session.user.tenantId,
            patientId: stay.patientId,
            stayId: stay.id,
            prescriberId,
            type: item.type,
            examCode: item.examCode,
            examLabel: item.examLabel,
            urgency: item.urgency,
            notes: notes || null,
          },
        })
      )
    );

    return NextResponse.json({ data: orders, success: true }, { status: 201 });
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id: stayId } = await params;

    const stay = await prisma.stay.findFirst({
      where: { id: stayId, tenantId: session.user.tenantId },
      select: { id: true },
    });

    if (!stay) {
      return NextResponse.json(
        { error: "Stay not found", success: false },
        { status: 404 }
      );
    }

    const orders = await prisma.examRequest.findMany({
      where: { stayId, tenantId: session.user.tenantId },
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
