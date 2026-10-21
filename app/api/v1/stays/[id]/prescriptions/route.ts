import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { parsePrescriptionLines } from "@/lib/stock/prescription-items";

// ── POST /api/v1/stays/:id/prescriptions ────────────────────────────────────
// Body: { prescriberId, notes?, items: [{ drug, dosage, frequency, duration, instructions?,
//         inventoryId?, quantity? }] }
// A line drawn from the stock names its article (inventoryId, an active article of this
// tenant) and the units to dispense; its drug name is the article's. A line without
// inventoryId is a drug the pharmacy does not stock (free text, never dispensed from stock).
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

    const { prescriberId, notes, items } = body;

    if (!prescriberId) {
      return NextResponse.json(
        { error: "prescriberId is required", success: false },
        { status: 400 }
      );
    }
    const parsedLines = parsePrescriptionLines(items);
    if (!parsedLines.ok) {
      return NextResponse.json(
        { error: parsedLines.error, code: parsedLines.error, line: parsedLines.index, success: false },
        { status: 400 }
      );
    }
    const articleIds = [...new Set(parsedLines.lines.map((line) => line.inventoryId).filter((id): id is string => Boolean(id)))];
    const articles = articleIds.length
      ? await prisma.medicationInventory.findMany({
          where: { id: { in: articleIds }, tenantId: session.user.tenantId, isActive: true },
          select: { id: true, name: true },
        })
      : [];
    if (articles.length !== articleIds.length) {
      return NextResponse.json({ error: "unknown_article", code: "unknown_article", success: false }, { status: 400 });
    }
    const articleNames = new Map(articles.map((a) => [a.id, a.name]));
    const lines = parsedLines.lines.map((line) => (line.inventoryId ? { ...line, drug: articleNames.get(line.inventoryId)! } : line));

    // Fetch the stay to get patientId (scoped to this tenant)
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

    const prescription = await prisma.prescription.create({
      data: {
        tenantId: session.user.tenantId,
        patientId: stay.patientId,
        stayId: stay.id,
        prescriberId,
        notes: typeof notes === "string" ? notes : null,
        items: lines as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ data: prescription, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/stays/:id/prescriptions]", error);
    return NextResponse.json(
      { error: "Failed to create prescription", success: false },
      { status: 500 }
    );
  }
}

// ── GET /api/v1/stays/:id/prescriptions ─────────────────────────────────────
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

    const prescriptions = await prisma.prescription.findMany({
      where: { stayId, tenantId: session.user.tenantId },
      orderBy: { prescribedAt: "desc" },
    });

    return NextResponse.json({ data: prescriptions, success: true });
  } catch (error) {
    console.error("[GET /api/v1/stays/:id/prescriptions]", error);
    return NextResponse.json(
      { error: "Failed to fetch prescriptions", success: false },
      { status: 500 }
    );
  }
}
