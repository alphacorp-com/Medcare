import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parsePostnatalVisit } from "@/lib/maternity/input";

// POST /api/v1/maternity/pregnancies/[id]/postnatal-visits
// Body: { visitDate?, vitaminAGiven?, ironFolateGiven?, breastfeedingCounseling?,
//         newbornExamined?, notes? } — post-natal consultation of the mother (and of her
// newborns) after a completed delivery. The RMA3 contact (0-48 h, day 6-10, 6 weeks) is derived
// from the delivery date in the report.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "create");
  if (!permCheck.ok) return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "A facility account is required" }, { status: 403 });

  const { id } = await context.params;
  try {
    const pregnancy = await prisma.pregnancy.findFirst({ where: { id, tenantId }, select: { id: true, delivery: { select: { deliveryDate: true } } } });
    if (!pregnancy) return NextResponse.json({ error: "Pregnancy not found" }, { status: 404 });
    const deliveryAt = pregnancy.delivery?.deliveryDate;
    if (!deliveryAt) return NextResponse.json({ error: "delivery_not_completed", code: "delivery_not_completed" }, { status: 409 });

    const parsed = parsePostnatalVisit(await req.json().catch(() => null), deliveryAt);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: parsed.error }, { status: 400 });

    const visit = await prisma.postnatalVisit.create({ data: { ...parsed.value, tenantId, pregnancyId: id, performedById: session.user.id } });
    return NextResponse.json(visit, { status: 201 });
  } catch (error) {
    console.error("Error creating postnatal visit:", error);
    return NextResponse.json({ error: "Failed to record the post-natal visit" }, { status: 500 });
  }
}
