import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { BillingSourceType } from "@prisma/client";

// GET /api/v1/billing/fee-schedule — list the tenant's tariff grid
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_BILLING", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(req.url);
  const sourceType = searchParams.get("sourceType") as BillingSourceType | null;

  const fees = await prisma.feeSchedule.findMany({
    where: { tenantId: session.user.tenantId, ...(sourceType ? { sourceType } : {}) },
    orderBy: [{ sourceType: "asc" }, { code: "asc" }],
  });

  return NextResponse.json(fees);
}

// POST /api/v1/billing/fee-schedule — add/update a tariff (upsert on tenant+sourceType+code)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_BILLING", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    if (!session.user.tenantId) {
      return NextResponse.json({ error: "No tenant on session" }, { status: 400 });
    }

    const body = await req.json();
    const { sourceType, code, label, unitPrice } = body as {
      sourceType?: BillingSourceType;
      code?: string;
      label?: string;
      unitPrice?: number | string;
    };

    if (!sourceType || !code?.trim() || !label?.trim() || unitPrice === undefined || unitPrice === null) {
      return NextResponse.json({ error: "sourceType, code, label and unitPrice are required" }, { status: 400 });
    }
    const price = Number(unitPrice);
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "unitPrice must be a non-negative number" }, { status: 400 });
    }

    const fee = await prisma.feeSchedule.upsert({
      where: { tenantId_sourceType_code: { tenantId: session.user.tenantId, sourceType, code: code.trim() } },
      update: { label: label.trim(), unitPrice: price, isActive: true },
      create: {
        tenantId: session.user.tenantId,
        sourceType,
        code: code.trim(),
        label: label.trim(),
        unitPrice: price,
      },
    });

    return NextResponse.json(fee, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/billing/fee-schedule]", error);
    return NextResponse.json({ error: "Failed to save tariff" }, { status: 400 });
  }
}
