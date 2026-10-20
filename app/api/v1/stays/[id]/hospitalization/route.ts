import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { recordAuditEvent, extractRequestMeta } from "@/lib/audit";
import { admitHospitalization } from "@/lib/billing/release";
import { chargeHospitalization, isPaymentGateActive, isVitalEmergency, removeUnpaidCharge } from "@/lib/billing/paymentGate";
import { getRoomTypeDailyPrice } from "@/lib/billing/roomPricing";

const MAX_DAYS = 365;

// ── POST /api/v1/stays/:id/hospitalization ──────────────────────────────────
// Body: { departmentId, bedId, days? }
// Hospitalises the patient after a signed consultation. The chosen bed is reserved and a
// deposit (caution) is billed: the daily price of the bed's room (salle, configured in
// Settings > Room types) × planned days — never a price sent by the client. The patient
// takes the bed once the cashier records the payment — or straight away for a vital
// emergency, or when billing is off. The deposit is regularised to the real length of stay
// at discharge. See lib/billing/paymentGate.ts.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_ADMISSION", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { departmentId, bedId } = body as { departmentId?: string; bedId?: string };
    const days = Number(body?.days ?? 1);

    if (!departmentId || !bedId) {
      return NextResponse.json({ error: "departmentId and bedId are required", success: false }, { status: 400 });
    }
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
      return NextResponse.json({ error: `days must be an integer between 1 and ${MAX_DAYS}`, success: false }, { status: 400 });
    }

    const tenantId = session.user.tenantId;
    const stay = await prisma.stay.findFirst({ where: { id, tenantId } });
    if (!stay) {
      return NextResponse.json({ error: "Stay not found", success: false }, { status: 404 });
    }
    if (stay.status !== "in_progress") {
      return NextResponse.json({ error: "Only an ongoing admission can be hospitalised", success: false }, { status: 400 });
    }
    if (stay.hospitalizationStatus) {
      return NextResponse.json({ error: "This patient is already hospitalised or awaiting payment for it", success: false }, { status: 409 });
    }
    const vitalEmergency = isVitalEmergency(stay);
    if (stay.consultationStatus !== "completed" && !vitalEmergency) {
      return NextResponse.json(
        { error: "The consultation must be signed before hospitalising the patient / La consultation doit être signée avant l'hospitalisation", success: false },
        { status: 400 }
      );
    }

    const [department, bed] = await Promise.all([
      prisma.department.findFirst({ where: { id: departmentId, tenantId } }),
      prisma.bed.findFirst({ where: { id: bedId, tenantId, isActive: true } }),
    ]);
    if (!department) return NextResponse.json({ error: "Department not found", success: false }, { status: 404 });
    if (!bed) return NextResponse.json({ error: "Bed not found", success: false }, { status: 404 });
    if (bed.departmentId !== department.id) {
      return NextResponse.json({ error: "Bed does not belong to the selected department", success: false }, { status: 409 });
    }

    // The price comes from the bed's room. With billing on, a room without a configured price
    // can't be hospitalised into — the deposit would otherwise be billed at 0.
    const room = bed.roomTypeId
      ? await prisma.referenceCatalogItem.findFirst({
          where: { id: bed.roomTypeId, tenantId, catalogType: "room_type", isActive: true },
          select: { code: true, nameFr: true },
        })
      : null;
    const billingActive = await isPaymentGateActive(tenantId);
    const dailyPrice = room ? await getRoomTypeDailyPrice(prisma, tenantId, room.code) : null;
    if (billingActive && (!room || dailyPrice === null)) {
      return NextResponse.json(
        {
          error: room
            ? `No daily price is configured for room "${room.nameFr}" — set it in Settings > Room types / Aucun prix journalier n'est défini pour la salle « ${room.nameFr} » — à configurer dans Paramètres > Types de salles`
            : "This bed is not assigned to an active room with a price — fix it in Settings > Beds / Ce lit n'est rattaché à aucune salle active avec un prix — à corriger dans Paramètres > Lits",
          success: false,
        },
        { status: 422 }
      );
    }

    // Reserve the bed atomically (the guarded updateMany only succeeds if it's still free)
    // and record the pending hospitalisation on the stay.
    await prisma.$transaction(async (tx) => {
      const reserved = await tx.bed.updateMany({
        where: { id: bed.id, tenantId, status: "available" },
        data: { status: "reserved", currentStayId: stay.id },
      });
      if (reserved.count !== 1) throw new Error("BED_CONFLICT");

      await tx.stay.update({
        where: { id: stay.id },
        data: {
          hospitalizationStatus: "awaiting_payment",
          // Legacy field (hospitalisations used to be billed through a medical act); the
          // price now comes from the bed's room.
          hospitalizationActCode: null,
          hospitalizationDepartmentId: department.id,
          hospitalizationBedId: bed.id,
          hospitalizationRequestedAt: new Date(),
        },
      });
    });

    const gateActive = billingActive && !vitalEmergency;
    const billing =
      room && dailyPrice !== null
        ? await chargeHospitalization({
            tenantId,
            patientId: stay.patientId,
            stayId: stay.id,
            room: { code: room.code, label: room.nameFr },
            dailyPrice,
            days,
            performedById: session.user.id,
          })
        : null;
    if (!gateActive || !billing) await admitHospitalization(stay.id);

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "stay.hospitalization_requested",
      resourceType: "stay",
      resourceId: stay.id,
      payload: { departmentId: department.id, bedId: bed.id, roomCode: room?.code ?? null, dailyPrice, days },
      ipAddress,
      userAgent,
    });

    const current = await prisma.stay.findUnique({ where: { id: stay.id } });
    return NextResponse.json({ data: current, billing, success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "BED_CONFLICT") {
      return NextResponse.json({ error: "This bed was just taken — choose another one", success: false }, { status: 409 });
    }
    console.error("[POST /api/v1/stays/:id/hospitalization]", error);
    return NextResponse.json({ error: "Failed to hospitalise patient", success: false }, { status: 500 });
  }
}

// ── DELETE /api/v1/stays/:id/hospitalization ────────────────────────────────
// Cancels a hospitalisation that hasn't been paid yet: frees the reserved bed and removes
// the unpaid charge from the invoice. An admitted patient leaves through transfer/discharge.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_ADMISSION", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const stay = await prisma.stay.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!stay) {
      return NextResponse.json({ error: "Stay not found", success: false }, { status: 404 });
    }
    if (stay.hospitalizationStatus !== "awaiting_payment") {
      return NextResponse.json({ error: "No pending hospitalisation to cancel", success: false }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (stay.hospitalizationBedId) {
        await tx.bed.updateMany({
          where: { id: stay.hospitalizationBedId, currentStayId: stay.id, status: "reserved" },
          data: { status: "available", currentStayId: null },
        });
      }
      await tx.stay.update({
        where: { id: stay.id },
        data: {
          hospitalizationStatus: null,
          hospitalizationActCode: null,
          hospitalizationDepartmentId: null,
          hospitalizationBedId: null,
          hospitalizationRequestedAt: null,
        },
      });
    });
    await removeUnpaidCharge("hospitalization", stay.id);

    const { ipAddress, userAgent } = extractRequestMeta(request.headers);
    await recordAuditEvent({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      actorType: "tenant_user",
      action: "stay.hospitalization_cancelled",
      resourceType: "stay",
      resourceId: stay.id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/v1/stays/:id/hospitalization]", error);
    return NextResponse.json({ error: "Failed to cancel hospitalisation", success: false }, { status: 500 });
  }
}
