import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parseIncomeRubric } from "@/lib/reports/rma3-income";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const categories = await prisma.medicalActCategory.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ order: "asc" }, { nameFr: "asc" }],
    include: { _count: { select: { acts: true } } },
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const body = await request.json();
    const { code, nameFr, nameEn, color, order, rma3IncomeRubric } = body as {
      code?: string; nameFr?: string; nameEn?: string; color?: string; order?: number; rma3IncomeRubric?: unknown;
    };
    // RMA3 VI.3 income rubric of the acts of the category (optional).
    const rubric = parseIncomeRubric(rma3IncomeRubric);
    if (rubric === "invalid") return NextResponse.json({ error: "invalid_rma3_rubric", code: "invalid_rma3_rubric" }, { status: 400 });
    if (!code?.trim() || !nameFr?.trim()) {
      return NextResponse.json({ error: "code and nameFr are required" }, { status: 400 });
    }

    const category = await prisma.medicalActCategory.create({
      data: {
        tenantId: session.user.tenantId,
        code: code.trim().toUpperCase(),
        nameFr: nameFr.trim(),
        nameEn: nameEn?.trim() || null,
        color: color || null,
        order: order ?? 0,
        rma3IncomeRubric: rubric,
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/settings/act-categories]", error);
    return NextResponse.json({ error: "Failed to create category (code may already exist)" }, { status: 400 });
  }
}
