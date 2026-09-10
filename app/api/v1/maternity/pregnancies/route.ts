import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { PregnancyStatus } from "@prisma/client";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true } as const;

const DAYS_280_MS = 280 * 24 * 60 * 60 * 1000;

// ── GET /api/v1/maternity/pregnancies ───────────────────────────────────────
// Query params: status, search (patient name/ipp)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as PregnancyStatus | null;
  const search = searchParams.get("search")?.trim();

  const pregnancies = await prisma.pregnancy.findMany({
    where: {
      tenantId: session.user.tenantId,
      status: status ?? undefined,
      ...(search
        ? {
            patient: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { ipp: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      patient: { select: PATIENT_SELECT },
      antenatalVisits: { orderBy: { visitDate: "desc" }, take: 1 },
      delivery: { select: { id: true, deliveryDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(pregnancies);
}

// ── POST /api/v1/maternity/pregnancies ──────────────────────────────────────
// Body: { patientId, lastMenstrualPeriod, gravida, para, expectedDueDate?, riskFactors?, notes? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "create");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const body = await req.json();
    const { patientId, lastMenstrualPeriod, gravida, para, expectedDueDate, riskFactors, notes } = body as {
      patientId?: string;
      lastMenstrualPeriod?: string;
      gravida?: number;
      para?: number;
      expectedDueDate?: string;
      riskFactors?: string[];
      notes?: string;
    };

    if (!patientId || !lastMenstrualPeriod || gravida === undefined || para === undefined) {
      return NextResponse.json(
        { error: "patientId, lastMenstrualPeriod, gravida and para are required" },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId: session.user.tenantId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const lmpDate = new Date(lastMenstrualPeriod);
    const dueDate = expectedDueDate ? new Date(expectedDueDate) : new Date(lmpDate.getTime() + DAYS_280_MS);

    const pregnancy = await prisma.pregnancy.create({
      data: {
        tenantId: session.user.tenantId,
        patientId,
        lastMenstrualPeriod: lmpDate,
        expectedDueDate: dueDate,
        gravida: Number(gravida),
        para: Number(para),
        riskFactors: riskFactors ?? [],
        notes: notes || null,
      },
      include: { patient: { select: PATIENT_SELECT } },
    });

    return NextResponse.json(pregnancy, { status: 201 });
  } catch (error) {
    console.error("Error creating pregnancy:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
