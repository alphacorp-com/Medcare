import type { Session } from "next-auth";
import prisma from "@/lib/prisma";
import { hasModulePermission, isAdminOrTenantAdmin } from "@/lib/permissions";

// HIV results are confidential: the result of an HIV exam (HIV test, infant PCR, HIV viral
// load — from the exam catalog settings) is only shown to the lab staff who enter or
// validate it, to prescribers (clinical-provider roles), to MODULE_HIV holders and admins.
// Everyone else still sees that the exam exists and its status, never its result.

export const CONFIDENTIAL_RESULT = { parameters: [], confidential: true } as const;

export interface HivResultAccess {
  canSee: boolean;
  confidentialCodes: ReadonlySet<string>;
}

export async function loadHivResultAccess(session: Session, tenantId: string): Promise<HivResultAccess> {
  const quick =
    isAdminOrTenantAdmin(session) ||
    hasModulePermission(session, "MODULE_HIV", "read") ||
    (["create", "update", "validate"] as const).some((action) => hasModulePermission(session, "MODULE_LAB", action));
  if (quick) return { canSee: true, confidentialCodes: new Set() };

  const [user, entries] = await Promise.all([
    prisma.tenantUser.findFirst({ where: { id: session.user.id, tenantId }, select: { role: { select: { isClinicalProvider: true } } } }),
    prisma.examCatalogEntry.findMany({
      where: { tenantId, OR: [{ screeningTestType: { in: ["hiv", "hiv_pcr"] } }, { viralLoadProgram: "hiv" }] },
      select: { code: true },
    }),
  ]);
  if (user?.role.isClinicalProvider) return { canSee: true, confidentialCodes: new Set() };
  return { canSee: false, confidentialCodes: new Set(entries.map((e) => e.code)) };
}

interface ResultLike {
  resultData?: unknown;
  reportUrl?: string | null;
  isCritical?: boolean;
}

// Pure: the same exams with the results of confidential exams emptied (the critical flag
// too: it would tell a positive result).
export function redactConfidentialExams<R extends ResultLike, T extends { examCode: string; results?: R[] }>(exams: T[], access: HivResultAccess): T[] {
  if (access.canSee || access.confidentialCodes.size === 0) return exams;
  return exams.map((exam) =>
    access.confidentialCodes.has(exam.examCode) && exam.results
      ? { ...exam, results: exam.results.map((r) => ({ ...r, resultData: CONFIDENTIAL_RESULT, reportUrl: null, isCritical: false })) }
      : exam
  );
}
