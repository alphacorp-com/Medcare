import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findSurgeryConflicts } from "@/lib/surgery/conflicts";
import { checkSurgeryReferences, roomLabels } from "@/lib/surgery/references";
import { DEFAULT_SURGERY_DURATION_MINUTES, parseAsaScore, parseDate, parseDuration, parseOptionalText, parseRequiredText, parseTeam, SURGERY_TEXT_LIMITS } from "@/lib/surgery/validation";
import { auditClinicalAction } from "@/lib/exams/audit";
import { requireModulePermission } from "@/lib/permissions";
import { Prisma, SurgicalStatus } from "@prisma/client";
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
    const labels = await roomLabels(session.user.tenantId, surgeries.map((s) => s.roomId));

    return NextResponse.json({
      data: surgeries.map((s) => ({ ...s, roomLabel: s.roomId ? labels.get(s.roomId) ?? null : null })),
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
//         procedureCode?, roomId? (an operating room, see /surgeries/rooms), scheduledAt, asaScore?,
//         expectedDurationMinutes?, isEmergency?, team? ([{ userId, role }]), force? }
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
    const body = (await req.json()) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const patientId = str(body.patientId);
    const surgeonId = str(body.surgeonId);
    if (!patientId || !surgeonId) {
      return NextResponse.json({ error: "patientId, surgeonId, procedureLabel and scheduledAt are required" }, { status: 400 });
    }
    const label = parseRequiredText(body.procedureLabel, "procedureLabel", SURGERY_TEXT_LIMITS.procedureLabel);
    const code = parseOptionalText(body.procedureCode, "procedureCode", SURGERY_TEXT_LIMITS.procedureCode);
    const scheduled = parseDate(body.scheduledAt, "scheduledAt");
    const asa = parseAsaScore(body.asaScore);
    if (!label.ok) return NextResponse.json({ error: label.error }, { status: 400 });
    if (!code.ok) return NextResponse.json({ error: code.error }, { status: 400 });
    if (!scheduled.ok) return NextResponse.json({ error: scheduled.error }, { status: 400 });
    if (!asa.ok) return NextResponse.json({ error: asa.error }, { status: 400 });
    const duration = parseDuration(body.expectedDurationMinutes);
    if (!duration.ok) return NextResponse.json({ error: duration.error }, { status: 400 });
    const team = parseTeam(body.team);
    if (!team.ok) return NextResponse.json({ error: team.error }, { status: 400 });

    const refs = { patientId, stayId: str(body.stayId), surgeonId, anesthesiologistId: str(body.anesthesiologistId), roomId: str(body.roomId), teamUserIds: team.value.map((m) => m.userId) };
    const refError = await checkSurgeryReferences(session.user.tenantId, refs);
    if (refError) return NextResponse.json({ error: refError.error }, { status: refError.status });

    const force = body.force === true;
    if (!force) {
      const conflicts = await findSurgeryConflicts({
        tenantId: session.user.tenantId,
        surgeonId,
        roomId: refs.roomId,
        scheduledAt: scheduled.value,
        durationMinutes: duration.value ?? DEFAULT_SURGERY_DURATION_MINUTES,
      });
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Scheduling conflict", conflicts }, { status: 409 });
      }
    }

    const surgery = await prisma.surgicalProcedure.create({
      data: {
        tenantId: session.user.tenantId,
        patientId,
        stayId: refs.stayId,
        surgeonId,
        anesthesiologistId: refs.anesthesiologistId,
        procedureLabel: label.value,
        procedureCode: code.value,
        roomId: refs.roomId,
        scheduledAt: scheduled.value,
        asaScore: asa.value,
        expectedDurationMinutes: duration.value,
        isEmergency: body.isEmergency === true,
        team: team.value as unknown as Prisma.InputJsonValue,
        status: "scheduled",
      },
      include: { patient: { select: PATIENT_SELECT } },
    });

    await auditClinicalAction(session, req, "surgery.schedule", { type: "surgical_procedure", id: surgery.id }, {
      patientId,
      surgeonId,
      roomId: refs.roomId,
      scheduledAt: scheduled.value.toISOString(),
      forced: force,
    });
    return NextResponse.json(surgery, { status: 201 });
  } catch (error) {
    console.error("Error creating surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
