import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { Gender } from "@prisma/client";
import { parseNewbornExtras } from "@/lib/maternity/input";

const toNumber = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// POST /api/v1/maternity/deliveries/[id]/newborns
// Body: { firstName?, sex, birthWeightGrams?, apgarScore1Min?, apgarScore5Min?,
//         vitaminKGiven?, resuscitationNeeded?, outcome? (alive|stillbirth|neonatal_death), notes?,
//         stillbirthType? (fresh|macerated, required for a stillbirth), bagMaskVentilation?,
//         diedAt? + deathCause? (required date for a neonatal death, within 28 days) }
// Creates a real Patient record for the newborn (with an auto-generated IPP) in the
// same transaction as the birth record, so paediatric follow-up is possible later.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "create");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const delivery = await prisma.delivery.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { pregnancy: { include: { patient: true } } },
    });
    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

    const body = await req.json();
    const { firstName, sex, birthWeightGrams, apgarScore1Min, apgarScore5Min, vitaminKGiven, resuscitationNeeded, notes } = body as {
      firstName?: string;
      sex?: Gender;
      birthWeightGrams?: number;
      apgarScore1Min?: number;
      apgarScore5Min?: number;
      vitaminKGiven?: boolean;
      resuscitationNeeded?: boolean;
      notes?: string;
    };

    if (sex !== "M" && sex !== "F" && sex !== "U") {
      return NextResponse.json({ error: "sex is required" }, { status: 400 });
    }

    const mother = delivery.pregnancy.patient;
    const birthDate = delivery.deliveryDate ?? new Date();
    const extras = parseNewbornExtras(body, birthDate);
    if (!extras.ok) return NextResponse.json({ error: extras.error, code: extras.error }, { status: 400 });

    const patientCount = await prisma.patient.count({ where: { tenantId: session.user.tenantId } });
    const ipp = `10${String(patientCount + 1).padStart(7, "0")}`;

    const newborn = await prisma.newborn.create({
      data: {
        tenantId: session.user.tenantId,
        delivery: { connect: { id } },
        sex,
        birthWeightGrams: toNumber(birthWeightGrams),
        apgarScore1Min: toNumber(apgarScore1Min),
        apgarScore5Min: toNumber(apgarScore5Min),
        vitaminKGiven: Boolean(vitaminKGiven),
        resuscitationNeeded: Boolean(resuscitationNeeded),
        outcome: extras.value.outcome,
        stillbirthType: extras.value.stillbirthType,
        bagMaskVentilation: extras.value.bagMaskVentilation,
        diedAt: extras.value.diedAt,
        deathCause: extras.value.deathCause,
        notes: notes || null,
        patient: {
          create: {
            tenantId: session.user.tenantId,
            ipp,
            firstName: firstName?.trim() || "Nouveau-né",
            lastName: mother.lastName,
            birthDate,
            gender: sex,
          },
        },
      },
      include: { patient: true },
    });

    return NextResponse.json(newborn, { status: 201 });
  } catch (error) {
    console.error("Error registering newborn:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
