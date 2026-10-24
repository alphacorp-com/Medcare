import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseCollectionSession } from "@/lib/blood-bank/input";
import { auditBlood, bloodError, requireBloodBankAccess } from "@/lib/blood-bank/route-auth";

// GET /api/v1/blood-bank/sessions — the 100 most recent mobile collections.
export async function GET() {
  const guard = await requireBloodBankAccess("read");
  if (!guard.ok) return guard.response;
  const sessions = await prisma.bloodCollectionSession.findMany({
    where: { tenantId: guard.access.tenantId },
    include: { _count: { select: { donations: true } } },
    orderBy: { heldAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ data: sessions });
}

// POST /api/v1/blood-bank/sessions — Body: { heldAt?, location }
export async function POST(request: Request) {
  const guard = await requireBloodBankAccess("create");
  if (!guard.ok) return guard.response;
  const parsed = parseCollectionSession(await request.json().catch(() => null));
  if (!parsed.ok) return bloodError(parsed.error);
  const created = await prisma.bloodCollectionSession.create({ data: { ...parsed.value, tenantId: guard.access.tenantId } });
  await auditBlood(request, guard.access, "blood_bank.session_create", "blood_collection_session", created.id);
  return NextResponse.json({ data: created }, { status: 201 });
}
