import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const STAY_PREFIX = "STAY";
const MAX_ATTEMPTS = 5;

// Next number after the highest existing STAYnnnnnn of the tenant. Based on the max
// rather than a row count, so a deleted stay or rows with another prefix (seeded STPJ…)
// can't make it hand out a number that already exists. Zero-padding keeps the lexical
// order equal to the numeric order up to STAY999999.
async function nextStayNumber(tenantId: string | null): Promise<string> {
  const last = await prisma.stay.findFirst({
    where: { tenantId, stayNumber: { startsWith: STAY_PREFIX } },
    orderBy: { stayNumber: "desc" },
    select: { stayNumber: true },
  });
  const lastSequence = last ? Number.parseInt(last.stayNumber.slice(STAY_PREFIX.length), 10) : 0;
  const next = (Number.isFinite(lastSequence) ? lastSequence : 0) + 1;
  return `${STAY_PREFIX}${String(next).padStart(6, "0")}`;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Runs `create` with a fresh stay number, retrying with the next one when a concurrent
// request took it first. The @@unique([tenantId, stayNumber]) constraint is what makes
// this safe: two simultaneous admissions can compute the same number, but only one
// insert succeeds and the other retries. `create` must be safe to re-run — typically a
// $transaction, which rolls back entirely on the violation.
export async function withNextStayNumber<T>(
  tenantId: string | null,
  create: (stayNumber: string) => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const stayNumber = await nextStayNumber(tenantId);
    try {
      return await create(stayNumber);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isUniqueViolation(error)) throw error;
    }
  }
}
