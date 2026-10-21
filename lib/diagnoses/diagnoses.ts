import type { DiagnosisContext, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { DiagnosisInput } from "@/lib/diagnoses/diagnosis-input";

// Server side of coded diagnoses: every code must exist (and be active) in the tenant's
// ICD-10 catalog, and the stored label is the catalog's — never the client's text.

export type ResolvedDiagnosis = DiagnosisInput & { label: string };

export type ResolveResult = { ok: true; value: ResolvedDiagnosis[] } | { ok: false; unknownCodes: string[] };

// Sub-codes (B50.9) are accepted when their exact code or their 3-character category is in
// the catalog (the shipped catalog holds categories only).
export async function resolveDiagnoses(tenantId: string | null, inputs: DiagnosisInput[]): Promise<ResolveResult> {
  if (inputs.length === 0) return { ok: true, value: [] };
  const candidates = [...new Set(inputs.flatMap((d) => [d.code, d.code.slice(0, 3)]))];
  const catalog = await prisma.icd10Code.findMany({
    where: { tenantId, isActive: true, code: { in: candidates } },
    select: { code: true, labelFr: true },
  });
  const labels = new Map(catalog.map((c) => [c.code, c.labelFr]));
  const unknownCodes: string[] = [];
  const value = inputs.map((d) => {
    const label = labels.get(d.code) ?? labels.get(d.code.slice(0, 3));
    if (!label) unknownCodes.push(d.code);
    return { ...d, label: label ?? "" };
  });
  return unknownCodes.length ? { ok: false, unknownCodes } : { ok: true, value };
}

export function diagnosisRows(
  diagnoses: ResolvedDiagnosis[],
  base: {
    tenantId: string | null;
    patientId: string;
    stayId: string | null;
    medicalRecordId?: string | null;
    context: DiagnosisContext;
    recordedById: string;
    recordedAt?: Date;
  }
): Prisma.DiagnosisCreateManyInput[] {
  return diagnoses.map((d) => ({
    tenantId: base.tenantId,
    patientId: base.patientId,
    stayId: base.stayId,
    medicalRecordId: base.medicalRecordId ?? null,
    context: base.context,
    kind: d.kind,
    icd10Code: d.code,
    label: d.label,
    isNewCase: d.isNewCase,
    recordedById: base.recordedById,
    ...(base.recordedAt ? { recordedAt: base.recordedAt } : {}),
  }));
}
