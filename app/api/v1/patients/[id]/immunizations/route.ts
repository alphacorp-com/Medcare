import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { ageInDaysAt } from "@/lib/patients/age";
import { randomUUID } from "node:crypto";
import { StockError, consumeStock, stockErrorResponse } from "@/lib/stock/movements";

// ── GET /api/v1/patients/:id/immunizations ──────────────────────────────────
// Immunization history for a patient, most recent first.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_DISEASE_PROGRAMS", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const immunizations = await prisma.immunization.findMany({
      where: { patientId: id, tenantId: session.user.tenantId },
      orderBy: { administeredAt: "desc" },
    });

    return NextResponse.json({ data: immunizations, total: immunizations.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/immunizations]", error);
    return NextResponse.json({ error: "Failed to fetch immunizations", success: false }, { status: 500 });
  }
}

// ── POST /api/v1/patients/:id/immunizations ─────────────────────────────────
// Body: { antigenCode, doseNumber?, administeredAt?, stockLotId?, lotNumber?, expiryDate?,
//         isOutOfSchedule?, notes? }
// When the antigen is managed in stock (an active article has vaccineAntigenCode = antigen),
// stockLotId is required: the dose is taken from that lot (one unit) in the same transaction,
// and the lot number / expiry come from the lot, not from the browser. Otherwise the lot
// stays free text as before.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_DISEASE_PROGRAMS", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { antigenCode, doseNumber, administeredAt, stockLotId, lotNumber, expiryDate, isOutOfSchedule, notes } = body as {
      antigenCode?: string; doseNumber?: number; administeredAt?: string; stockLotId?: string; lotNumber?: string;
      expiryDate?: string; isOutOfSchedule?: boolean; notes?: string;
    };
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 });
    }

    if (!antigenCode) {
      return NextResponse.json({ error: "antigenCode is required", success: false }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true, birthDate: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const antigen = await prisma.referenceCatalogItem.findFirst({
      where: { tenantId: session.user.tenantId, catalogType: "vaccine_antigen", code: antigenCode },
      select: { code: true, nameFr: true },
    });
    if (!antigen) {
      return NextResponse.json({ error: "Unknown antigen code", success: false }, { status: 400 });
    }

    const eventDate = administeredAt ? new Date(administeredAt) : new Date();
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Invalid administeredAt", success: false }, { status: 400 });
    }

    // Is this antigen supplied from the stock? Then the lot must be one of its lots.
    const stockItems = await prisma.medicationInventory.findMany({
      where: { tenantId, isActive: true, vaccineAntigenCode: antigen.code },
      select: { id: true },
    });
    let stockLot: { id: string; itemId: string } | null = null;
    if (stockItems.length > 0) {
      if (typeof stockLotId !== "string" || !stockLotId) {
        return NextResponse.json({ error: "stock_lot_required", code: "stock_lot_required", success: false }, { status: 400 });
      }
      stockLot = await prisma.stockLot.findFirst({
        where: { id: stockLotId, tenantId, itemId: { in: stockItems.map((i) => i.id) } },
        select: { id: true, itemId: true },
      });
      if (!stockLot) {
        return NextResponse.json({ error: "lot_not_found", code: "lot_not_found", success: false }, { status: 400 });
      }
    }

    const immunizationId = randomUUID();
    // Lot number / expiry typed by the user apply only to antigens not managed in stock.
    const data = {
      id: immunizationId,
      tenantId,
      patientId: id,
      antigenCode: antigen.code,
      antigenName: antigen.nameFr,
      doseNumber: doseNumber ?? 1,
      administeredAt: eventDate,
      administeredById: session.user.id,
      ageInDaysAtAdministration: ageInDaysAt(patient.birthDate, eventDate),
      lotNumber: lotNumber || null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      isOutOfSchedule: isOutOfSchedule ?? false,
      notes: notes || null,
    };

    let immunization;
    try {
      immunization = await prisma.$transaction(async (tx) => {
        if (!stockLot) return tx.immunization.create({ data });
        const { allocations } = await consumeStock(tx, {
          tenantId,
          userId: session.user.id,
          itemId: stockLot.itemId,
          lotId: stockLot.id,
          quantity: 1,
          type: "vaccination",
          sourceType: "immunization",
          sourceId: immunizationId,
          occurredAt: eventDate,
        });
        const [taken] = allocations;
        return tx.immunization.create({
          data: { ...data, stockLotId: stockLot.id, lotNumber: taken.lotNumber, expiryDate: taken.expiryDate },
        });
      });
    } catch (error) {
      if (error instanceof StockError) {
        const { status, body: errorBody } = stockErrorResponse(error);
        return NextResponse.json(errorBody, { status });
      }
      throw error;
    }

    return NextResponse.json({ data: immunization, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/patients/:id/immunizations]", error);
    return NextResponse.json({ error: "Failed to record immunization", success: false }, { status: 500 });
  }
}
