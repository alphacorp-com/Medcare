import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/v1/medical-acts
// Read-only lookup consumed by the "add medical order" picker (cardiology/pathology/
// other acts not covered by the labo/radio exam catalog). Any authenticated tenant
// member can read it, same access level as /api/v1/exam-catalog; editing happens
// under Settings → Medical Acts.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const acts = await prisma.medicalAct.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    include: { category: { select: { id: true, nameFr: true } } },
    orderBy: [{ category: { order: "asc" } }, { nameFr: "asc" }],
  });

  const items = acts.map((act) => ({
    code: act.code,
    label: act.nameFr,
    price: act.basePrice ? Number(act.basePrice) : null,
    categoryId: act.categoryId,
    categoryName: act.category.nameFr,
  }));

  return NextResponse.json(items);
}
