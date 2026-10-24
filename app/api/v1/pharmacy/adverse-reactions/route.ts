import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { pharmacyGuard } from "@/lib/stock/pharmacy-guard";
import { monthRange } from "@/lib/epi/route-auth";
import { parseAdverseReaction } from "@/lib/programs/input-complements";

// Pharmacovigilance (RMA3 V.8): adverse drug reactions, pharmacy module.

const PATIENT = { select: { id: true, firstName: true, lastName: true, ipp: true } } as const;
const bad = (code: string, status = 400) => NextResponse.json({ error: code, code }, { status });

// GET /api/v1/pharmacy/adverse-reactions?month=YYYY-MM — reactions reported in a month.
export async function GET(request: Request) {
  const guard = await pharmacyGuard("read");
  if (!guard.ok) return guard.response;
  const range = monthRange(new URL(request.url).searchParams.get("month"));
  if (!range) return bad("invalid_month");
  const reactions = await prisma.drugAdverseReaction.findMany({
    where: { tenantId: guard.tenantId, createdAt: { gte: range.start, lt: range.end } },
    include: { patient: PATIENT },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: reactions });
}

// POST /api/v1/pharmacy/adverse-reactions
// Body: { patientId, inventoryId? (stock article) or drugName, lotNumber?, expiryDate?, reactionAt?,
//         description, serious? } — the drug name comes from the article when one is chosen.
export async function POST(request: Request) {
  const guard = await pharmacyGuard("create");
  if (!guard.ok) return guard.response;
  const parsed = parseAdverseReaction(await request.json().catch(() => null));
  if (!parsed.ok) return bad(parsed.error);
  const v = parsed.value;
  const patient = await prisma.patient.findFirst({ where: { id: v.patientId, tenantId: guard.tenantId }, select: { id: true } });
  if (!patient) return bad("invalid_patient");
  let drugName = v.drugName;
  if (v.inventoryId) {
    const item = await prisma.medicationInventory.findFirst({ where: { id: v.inventoryId, tenantId: guard.tenantId }, select: { name: true } });
    if (!item) return bad("invalid_drug");
    drugName = item.name;
  }
  const reaction = await prisma.drugAdverseReaction.create({ data: { ...v, drugName, tenantId: guard.tenantId, recordedById: guard.userId }, include: { patient: PATIENT } });
  return NextResponse.json({ data: reaction }, { status: 201 });
}
