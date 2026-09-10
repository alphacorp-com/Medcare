import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toUuid = (v: unknown): string | null =>
  typeof v === "string" && UUID_RE.test(v) ? v : null;

// POST /api/v1/maternity/pregnancies/[id]/delivery
// Body: { stayId? } — opens a delivery/labour record for this pregnancy, ready for partograph entries.
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
    const pregnancy = await prisma.pregnancy.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: { delivery: true },
    });
    if (!pregnancy) return NextResponse.json({ error: "Pregnancy not found" }, { status: 404 });
    if (pregnancy.delivery) {
      return NextResponse.json({ error: "A delivery record already exists for this pregnancy" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const stayId = toUuid(body.stayId);

    const delivery = await prisma.delivery.create({
      data: {
        tenantId: session.user.tenantId,
        pregnancyId: id,
        stayId,
        attendedById: session.user.id,
      },
    });

    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    console.error("Error starting delivery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
