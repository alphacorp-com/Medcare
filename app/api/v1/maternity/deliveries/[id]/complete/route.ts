import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { DeliveryMode } from "@prisma/client";

// PATCH /api/v1/maternity/deliveries/[id]/complete
// Body: { mode, complications?, maternalOutcome?, placentaDelivered?, bloodLossMl?, notes? }
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { mode, complications, maternalOutcome, placentaDelivered, bloodLossMl, notes } = body as {
      mode?: DeliveryMode;
      complications?: string[];
      maternalOutcome?: string;
      placentaDelivered?: boolean;
      bloodLossMl?: number | string;
      notes?: string;
    };

    if (!mode) {
      return NextResponse.json({ error: "mode is required" }, { status: 400 });
    }

    const bloodLossMlValue =
      bloodLossMl === undefined || bloodLossMl === null || bloodLossMl === ""
        ? null
        : Number(bloodLossMl);
    if (bloodLossMlValue !== null && Number.isNaN(bloodLossMlValue)) {
      return NextResponse.json({ error: "bloodLossMl must be a number" }, { status: 400 });
    }

    const delivery = await prisma.delivery.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { pregnancy: true },
    });
    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    if (delivery.deliveryDate) {
      return NextResponse.json({ error: "This delivery is already completed" }, { status: 400 });
    }

    const deliveryDate = new Date();

    const [updatedDelivery] = await prisma.$transaction([
      prisma.delivery.update({
        where: { id },
        data: {
          deliveryDate,
          mode,
          complications: complications ?? [],
          maternalOutcome: maternalOutcome || "alive",
          placentaDelivered: Boolean(placentaDelivered),
          bloodLossMl: bloodLossMlValue,
          notes: notes || null,
        },
      }),
      prisma.pregnancy.update({
        where: { id: delivery.pregnancyId },
        data: { status: "delivered" },
      }),
      ...(delivery.stayId
        ? [
            prisma.medicalRecord.create({
              data: {
                patientId: delivery.pregnancy.patientId,
                stayId: delivery.stayId,
                authorId: session.user.id,
                type: "delivery_report" as const,
                title: "Compte-rendu d'accouchement",
                content: notes || `Accouchement (${mode}) le ${deliveryDate.toISOString()}.`,
                isSigned: true,
                signedAt: deliveryDate,
                signedBy: session.user.id,
              },
            }),
          ]
        : []),
    ]);

    return NextResponse.json(updatedDelivery);
  } catch (error) {
    console.error("Error completing delivery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
