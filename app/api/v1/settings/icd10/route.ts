import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";

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
  const search = searchParams.get("search")?.trim();

  const codes = await prisma.icd10Code.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { labelFr: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { code: "asc" },
    take: 200,
  });

  return NextResponse.json(codes);
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
    const { code, labelFr, labelEn, chapter } = body as {
      code?: string; labelFr?: string; labelEn?: string; chapter?: string;
    };
    if (!code?.trim() || !labelFr?.trim()) {
      return NextResponse.json({ error: "code and labelFr are required" }, { status: 400 });
    }

    const entry = await prisma.icd10Code.create({
      data: {
        tenantId: session.user.tenantId,
        code: code.trim().toUpperCase(),
        labelFr: labelFr.trim(),
        labelEn: labelEn?.trim() || null,
        chapter: chapter?.trim() || null,
      },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/settings/icd10]", error);
    return NextResponse.json({ error: "Failed to create code (it may already exist)" }, { status: 400 });
  }
}
