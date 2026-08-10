import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { ExamCatalogDomain } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain") as ExamCatalogDomain | null;

  const types = await prisma.examCatalogType.findMany({
    where: { tenantId: session.user.tenantId, ...(domain ? { domain } : {}) },
    orderBy: [{ domain: "asc" }, { order: "asc" }],
    include: { _count: { select: { entries: true } } },
  });

  return NextResponse.json(types);
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
    const { domain, code, nameFr, nameEn, order } = body as {
      domain?: ExamCatalogDomain; code?: string; nameFr?: string; nameEn?: string; order?: number;
    };
    if (!domain || !code?.trim() || !nameFr?.trim()) {
      return NextResponse.json({ error: "domain, code and nameFr are required" }, { status: 400 });
    }

    const type = await prisma.examCatalogType.create({
      data: {
        tenantId: session.user.tenantId,
        domain,
        code: code.trim().toUpperCase(),
        nameFr: nameFr.trim(),
        nameEn: nameEn?.trim() || null,
        order: order ?? 0,
      },
    });
    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/settings/exam-types]", error);
    return NextResponse.json({ error: "Failed to create exam type (code may already exist)" }, { status: 400 });
  }
}
