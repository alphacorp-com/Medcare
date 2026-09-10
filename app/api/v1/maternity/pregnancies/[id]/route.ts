import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { PregnancyStatus } from "@prisma/client";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true, birthDate: true } as const;

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

  const pregnancy = await prisma.pregnancy.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      patient: { select: PATIENT_SELECT },
      antenatalVisits: { orderBy: { visitDate: "desc" } },
      examRequests: {
        where: { type: "biology" },
        include: { results: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { requestedAt: "desc" },
      },
      delivery: {
        include: {
          partograph: { orderBy: { recordedAt: "asc" } },
          newborns: { include: { patient: { select: PATIENT_SELECT } } },
        },
      },
    },
  });

  if (!pregnancy) return NextResponse.json({ error: "Pregnancy not found" }, { status: 404 });
  return NextResponse.json(pregnancy);
}

// PATCH /api/v1/maternity/pregnancies/[id]
// Body: { status?, notes? }
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
    const existing = await prisma.pregnancy.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Pregnancy not found" }, { status: 404 });

    const { status, notes } = (await req.json()) as { status?: PregnancyStatus; notes?: string };

    const pregnancy = await prisma.pregnancy.update({
      where: { id },
      data: {
        status: status ?? undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    return NextResponse.json(pregnancy);
  } catch (error) {
    console.error("Error updating pregnancy:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
