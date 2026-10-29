import prisma from "@/lib/prisma";
import { EXAM_LIST_DOMAINS, type ExamListDomain } from "./exam-list";

// An exam request of ONE module (laboratory or radiology), scoped to the tenant. The module
// permissions are separate (MODULE_LAB / MODULE_RADIOLOGY): a route of one module must never act
// on an id of the other, or a radiology user could validate a lab result, cancel a lab order,
// etc. Every action route looks the exam up through here.
export function findExamOfModule(id: string, tenantId: string | null | undefined, domain: ExamListDomain) {
  return prisma.examRequest.findFirst({ where: { id, tenantId: tenantId ?? null, type: { in: EXAM_LIST_DOMAINS[domain].types } } });
}

// Same scope for a nested lookup (an exam result, a where clause on the request).
export function examOfModuleWhere(tenantId: string | null | undefined, domain: ExamListDomain) {
  return { tenantId: tenantId ?? null, type: { in: EXAM_LIST_DOMAINS[domain].types } };
}
