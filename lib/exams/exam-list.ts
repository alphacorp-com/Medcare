import type { ExamType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { PagedResponse, Pagination } from "@/lib/pagination";

// Paged, filtered exam worklists for the laboratory and radiology pages. The workflow
// states shown in the UI aren't stored: they're derived from the request status and its
// results. Each state is defined ONCE here as a Prisma condition, used both to filter the
// page and to count the tabs, so a filter and its counter can't disagree.
//
// "Awaiting validation/report" = in progress with an unvalidated result — the same
// condition the validate routes require. The UI used to look at the latest result only;
// it's equivalent because result entry reuses the pending result instead of adding one.

type StateWhere = Record<string, Prisma.ExamRequestWhereInput>;

const UNVALIDATED_RESULT: Prisma.ExamRequestWhereInput = { results: { some: { validatedAt: null } } };
const NO_UNVALIDATED_RESULT: Prisma.ExamRequestWhereInput = { results: { none: { validatedAt: null } } };

export const EXAM_LIST_DOMAINS = {
  laboratory: {
    types: ["biology"] as ExamType[],
    patientSelect: { id: true, firstName: true, lastName: true, ipp: true, gender: true },
    states: {
      awaiting_payment: { status: "awaiting_payment" },
      pending_sample: { status: { in: ["requested", "scheduled"] } },
      in_analysis: { status: "in_progress", ...NO_UNVALIDATED_RESULT },
      awaiting_validation: { status: "in_progress", ...UNVALIDATED_RESULT },
      completed: { status: "completed" },
      cancelled: { status: "cancelled" },
    } satisfies StateWhere,
  },
  radiology: {
    types: ["radiology"] as ExamType[],
    // Allergies are shown before contrast imaging.
    patientSelect: { id: true, firstName: true, lastName: true, ipp: true, gender: true, allergies: true },
    states: {
      awaiting_payment: { status: "awaiting_payment" },
      pending_schedule: { status: "requested" },
      scheduled: { status: "scheduled" },
      in_progress: { status: "in_progress", ...NO_UNVALIDATED_RESULT },
      awaiting_report: { status: "in_progress", ...UNVALIDATED_RESULT },
      completed: { status: "completed" },
      cancelled: { status: "cancelled" },
    } satisfies StateWhere,
  },
} as const;

export type ExamListDomain = keyof typeof EXAM_LIST_DOMAINS;
const CRITICAL: Prisma.ExamRequestWhereInput = { results: { some: { isCritical: true } } };

export interface ExamListQuery {
  tenantId: string | null;
  domain: ExamListDomain;
  // A state of the domain, "critical", or null for everything. Anything else is ignored.
  filter: string | null;
  search: string | null;
  pagination: Pagination;
}

function searchWhere(search: string | null): Prisma.ExamRequestWhereInput {
  const q = search?.trim();
  if (!q) return {};
  return {
    OR: [
      { examLabel: { contains: q, mode: "insensitive" } },
      { examCode: { contains: q, mode: "insensitive" } },
      { patient: { firstName: { contains: q, mode: "insensitive" } } },
      { patient: { lastName: { contains: q, mode: "insensitive" } } },
      { patient: { ipp: { contains: q, mode: "insensitive" } } },
    ],
  };
}

export function filterWhere(domain: ExamListDomain, filter: string | null): Prisma.ExamRequestWhereInput {
  if (filter === "critical") return CRITICAL;
  const states: StateWhere = EXAM_LIST_DOMAINS[domain].states;
  return filter && Object.hasOwn(states, filter) ? states[filter] : {};
}

export async function listExams({ tenantId, domain, filter, search, pagination }: ExamListQuery) {
  const config = EXAM_LIST_DOMAINS[domain];
  const scope: Prisma.ExamRequestWhereInput = { tenantId, type: { in: config.types } };
  const where: Prisma.ExamRequestWhereInput = { AND: [scope, filterWhere(domain, filter), searchWhere(search)] };
  const stateNames = Object.keys(config.states);

  // Page, total and every tab counter in parallel; the counters ignore filter and search.
  const [exams, total, ...counters] = await Promise.all([
    prisma.examRequest.findMany({
      where,
      include: {
        patient: { select: config.patientSelect },
        results: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { requestedAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.examRequest.count({ where }),
    ...stateNames.map((state) => prisma.examRequest.count({ where: { AND: [scope, filterWhere(domain, state)] } })),
    prisma.examRequest.count({ where: { AND: [scope, CRITICAL] } }),
  ]);

  // Prescriber names for this page only, in one query (the page used to fetch the whole
  // user directory, which is admin-only and failed for lab/radiology staff).
  const prescriberIds = [...new Set(exams.map((e) => e.prescriberId))];
  const prescribers = prescriberIds.length
    ? await prisma.tenantUser.findMany({ where: { id: { in: prescriberIds }, tenantId }, select: { id: true, fullName: true } })
    : [];
  const prescriberNames = new Map(prescribers.map((p) => [p.id, p.fullName]));

  const counts: Record<string, number> = Object.fromEntries(stateNames.map((state, i) => [state, counters[i]]));
  counts.critical = counters[stateNames.length];

  const response: PagedResponse<(typeof exams)[number] & { prescriberName: string | null }, Record<string, number>> = {
    data: exams.map((exam) => ({ ...exam, prescriberName: prescriberNames.get(exam.prescriberId) ?? null })),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    counts,
  };
  return response;
}
