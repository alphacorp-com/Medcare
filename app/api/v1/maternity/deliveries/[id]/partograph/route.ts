import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

const toNumber = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  const entries = await prisma.partographEntry.findMany({
    where: { deliveryId: id, tenantId: session.user.tenantId },
    orderBy: { recordedAt: "asc" },
  });

  return NextResponse.json(entries);
}

// POST /api/v1/maternity/deliveries/[id]/partograph
// Body: { cervicalDilationCm?, fetalHeartRate?, contractionsPer10Min?, contractionDurationSec?,
//         maternalPulse?, maternalBpSystolic?, maternalBpDiastolic?, amnioticFluid? }
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
    const delivery = await prisma.delivery.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    if (delivery.deliveryDate) {
      return NextResponse.json({ error: "This delivery is already completed" }, { status: 400 });
    }

    const body = await req.json();

    const entry = await prisma.partographEntry.create({
      data: {
        tenantId: session.user.tenantId,
        deliveryId: id,
        recordedById: session.user.id,
        cervicalDilationCm: toNumber(body.cervicalDilationCm),
        fetalHeartRate: toNumber(body.fetalHeartRate),
        contractionsPer10Min: toNumber(body.contractionsPer10Min),
        contractionDurationSec: toNumber(body.contractionDurationSec),
        maternalPulse: toNumber(body.maternalPulse),
        maternalBpSystolic: toNumber(body.maternalBpSystolic),
        maternalBpDiastolic: toNumber(body.maternalBpDiastolic),
        amnioticFluid: body.amnioticFluid || null,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error recording partograph entry:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
