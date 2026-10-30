import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { duplicateReasons, MAX_DUPLICATE_MATCHES, normalizePhone, type DuplicateInput, type DuplicateReason } from "./duplicates";

// Records of the facility that may be the patient being created (rules: ./duplicates). The
// database narrows to the same birth date, NSS or phone ending; the rules decide.
const CANDIDATE_LIMIT = 300;

export async function findDuplicateCandidates(tenantId: string | null, input: DuplicateInput) {
  const nss = input.nss?.trim();
  const phone = normalizePhone(input.phone);
  const candidates = await prisma.patient.findMany({
    where: {
      tenantId,
      OR: [
        { birthDate: input.birthDate },
        ...(nss ? [{ nss: { equals: nss, mode: "insensitive" as const } }] : []),
        // Stored phones are free text: the last 8 digits are searched, the rules compare.
        ...(phone ? [{ phone: { contains: phone.slice(-8) } }] : []),
      ],
    },
    select: { id: true, ipp: true, firstName: true, lastName: true, birthDate: true, nss: true, phone: true },
    take: CANDIDATE_LIMIT,
  });
  const matches: { id: string; ipp: string; firstName: string; lastName: string; birthDate: Date; nss: string | null; reasons: DuplicateReason[] }[] = [];
  for (const candidate of candidates) {
    const reasons = duplicateReasons(input, candidate);
    if (reasons.length > 0) {
      const { phone: _phone, ...shown } = candidate;
      matches.push({ ...shown, reasons });
    }
    if (matches.length >= MAX_DUPLICATE_MATCHES) break;
  }
  return matches;
}

// ── Patient number (IPP) ─────────────────────────────────────────────────────

const IPP_PREFIX = "10";
const MAX_ATTEMPTS = 5;

// "10" + 7 digits, after the highest existing one of the facility (not a row count: a deleted
// record or an imported number would make a count hand out a number already taken).
async function nextIpp(tenantId: string | null): Promise<string> {
  const rows = await prisma.$queryRaw<{ last: number | null }[]>(Prisma.sql`
    SELECT max(substring(ipp from 3)::int) AS last
    FROM "tenant_template"."patients"
    WHERE tenant_id IS NOT DISTINCT FROM ${tenantId}::uuid AND ipp ~ '^10[0-9]{7}$'
  `);
  const next = (rows[0]?.last ?? 0) + 1;
  return `${IPP_PREFIX}${String(next).padStart(7, "0")}`;
}

const isIppCollision = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002" &&
  JSON.stringify(error.meta?.target ?? "").includes("ipp");

// Runs `create` with a fresh IPP, retrying with the next one when a simultaneous creation took
// it first (the @@unique([tenantId, ipp]) constraint makes this safe).
export async function withNextIpp<T>(tenantId: string | null, create: (ipp: string) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const ipp = await nextIpp(tenantId);
    try {
      return await create(ipp);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isIppCollision(error)) throw error;
    }
  }
}
