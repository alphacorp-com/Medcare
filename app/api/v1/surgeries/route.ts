import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findSurgeryConflicts } from "@/lib/surgery/conflicts";
import { requireModulePermission } from "@/lib/permissions";
import { SurgicalStatus, type Prisma } from "@prisma/client";
import { parsePagination } from "@/lib/pagination";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true } as const;

// ── GET /api/v1/surgeries ───────────────────────────────────────────────────
// Paged list: ?status=, ?search= (patient name/IPP, procedure), ?surgeonId=, ?from=, ?to=
// (ISO, on scheduledAt), ?page=, ?pageSize=. Also returns per-status counts over the whole
// tenant for the summary tiles. Upcoming surgeries ("scheduled") are listed soonest first;
// every other view most recent first, so page 1 never starts with years-old history.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_SURGERY", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  const status = rawStatus && (Object.values(SurgicalStatus) as string[]).includes(rawStatus) ? (rawStatus as SurgicalStatus) : null;
  const surgeonId = searchParams.get("surgeonId");
  const from = searchParams.get("from") ? new Date(searchParams.get("from") as string) : null;
  const to = searchParams.get("to") ? new Date(searchParams.get("to") as string) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return NextResponse.json({ error: "from/to must be ISO dates" }, { status: 400 });
  }
  const search = searchParams.get("search")?.trim();
  const pagination = parsePagination(searchParams);

  const tenantScope: Prisma.SurgicalProcedureWhereInput = { tenantId: session.user.tenantId };
  const where: Prisma.SurgicalProcedureWhereInput = {
    ...tenantScope,
    ...(status ? { status } : {}),
    ...(surgeonId ? { surgeonId } : {}),
    ...(from || to ? { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(search
      ? {
          OR: [
            { procedureLabel: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
            { patient: { ipp: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  try {
    const [surgeries, total, statusGroups] = await Promise.all([
      prisma.surgicalProcedure.findMany({
        where,
        include: { patient: { select: PATIENT_SELECT } },
        orderBy: { scheduledAt: status === "scheduled" ? "asc" : "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.surgicalProcedure.count({ where }),
      prisma.surgicalProcedure.groupBy({ by: ["status"], where: tenantScope, _count: true }),
    ]);

    return NextResponse.json({
      data: surgeries,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      counts: Object.fromEntries(statusGroups.map((g) => [g.status, g._count])),
    });
  } catch (error) {
    console.error("[GET /api/v1/surgeries]", error);
    return NextResponse.json({ error: "Failed to load surgeries" }, { status: 500 });
  }
}

// ── POST /api/v1/surgeries ──────────────────────────────────────────────────
// Body: { patientId, stayId?, surgeonId, anesthesiologistId?, procedureLabel,
//         procedureCode?, roomId?, scheduledAt, asaScore?, force? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_SURGERY", "create");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const body = await req.json();
    const {
      patientId,
      stayId,
      surgeonId,
      anesthesiologistId,
      procedureLabel,
      procedureCode,
      roomId,
      scheduledAt,
      asaScore,
      force,
    } = body;

    if (!patientId || !surgeonId || !procedureLabel || !scheduledAt) {
      return NextResponse.json(
        { error: "patientId, surgeonId, procedureLabel and scheduledAt are required" },
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

    if (stayId) {
      const stay = await prisma.stay.findFirst({
        where: { id: stayId, tenantId: session.user.tenantId },
        select: { id: true },
      });
      if (!stay) {
        return NextResponse.json({ error: "Stay not found" }, { status: 404 });
      }
    }

    const scheduledDate = new Date(scheduledAt);

    if (!force) {
      const conflicts = await findSurgeryConflicts({
        surgeonId,
        roomId: roomId || null,
        scheduledAt: scheduledDate,
      });
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Scheduling conflict", conflicts }, { status: 409 });
      }
    }

    const surgery = await prisma.surgicalProcedure.create({
      data: {
        tenantId: session.user.tenantId,
        patientId,
        stayId: stayId || null,
        surgeonId,
        anesthesiologistId: anesthesiologistId || null,
        procedureLabel,
        procedureCode: procedureCode || null,
        roomId: roomId || null,
        scheduledAt: scheduledDate,
        asaScore: asaScore ? Number(asaScore) : null,
        status: "scheduled",
      },
      include: { patient: { select: PATIENT_SELECT } },
    });

    return NextResponse.json(surgery, { status: 201 });
  } catch (error) {
    console.error("Error creating surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
