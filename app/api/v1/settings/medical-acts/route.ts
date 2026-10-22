import { NextResponse } from "next/server";
import { parseRma3ActIndicator } from "@/lib/reports/rma3-acts";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { syncExamFeeSchedule } from "@/lib/billing/syncFeeSchedule";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const acts = await prisma.medicalAct.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ nameFr: "asc" }],
    include: { category: { select: { id: true, nameFr: true, nameEn: true, color: true } } },
  });

  return NextResponse.json(acts);
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
    const {
      categoryId, code, nameFr, nameEn, basePrice, unit,
      defaultPecCoveragePercent, allowsUrgencySurcharge, requiresLabValidation, rma3Indicator,
    } = body as {
      categoryId?: string; code?: string; nameFr?: string; nameEn?: string;
      basePrice?: number | string; unit?: string;
      defaultPecCoveragePercent?: number; allowsUrgencySurcharge?: boolean; requiresLabValidation?: boolean; rma3Indicator?: unknown;
    };
    // RMA3 act indicator (lib/reports/rma3-acts): optional, one of the known codes.
    const indicator = rma3Indicator === undefined ? null : parseRma3ActIndicator(rma3Indicator);
    if (indicator === "invalid") {
      return NextResponse.json({ error: "invalid_rma3_indicator", code: "invalid_rma3_indicator" }, { status: 400 });
    }

    if (!categoryId || !code?.trim() || !nameFr?.trim() || basePrice === undefined || basePrice === null) {
      return NextResponse.json({ error: "categoryId, code, nameFr and basePrice are required" }, { status: 400 });
    }
    const price = Number(basePrice);
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "basePrice must be a non-negative number" }, { status: 400 });
    }

    const category = await prisma.medicalActCategory.findFirst({ where: { id: categoryId, tenantId: session.user.tenantId } });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const act = await prisma.medicalAct.create({
      data: {
        tenantId: session.user.tenantId,
        categoryId,
        code: code.trim().toUpperCase(),
        nameFr: nameFr.trim(),
        nameEn: nameEn?.trim() || null,
        basePrice: price,
        unit: unit?.trim() || null,
        defaultPecCoveragePercent: defaultPecCoveragePercent ?? 0,
        allowsUrgencySurcharge: Boolean(allowsUrgencySurcharge),
        requiresLabValidation: Boolean(requiresLabValidation),
        rma3Indicator: indicator,
      },
      include: { category: { select: { id: true, nameFr: true, nameEn: true, color: true } } },
    });

    await syncExamFeeSchedule({
      tenantId: session.user.tenantId,
      code: act.code,
      label: act.nameFr,
      price: Number(act.basePrice),
      isActive: act.isActive,
    });

    return NextResponse.json(act, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/settings/medical-acts]", error);
    return NextResponse.json({ error: "Failed to create medical act (code may already exist)" }, { status: 400 });
  }
}
