import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { monthRange } from "@/lib/epi/route-auth";
import { parseDonation } from "@/lib/blood-bank/input";
import { auditBlood, bloodError, requireBloodBankAccess } from "@/lib/blood-bank/route-auth";

const BAG_STATUSES = new Set(["quarantine", "available", "served", "transfused", "destroyed"]);
const INCLUDE = {
  donor: { select: { id: true, code: true, fullName: true, donorType: true, bloodGroup: true } },
  session: { select: { id: true, heldAt: true, location: true } },
} as const;

// GET /api/v1/blood-bank/donations?status=…  — bags in a given state (stock of the bank)
// GET /api/v1/blood-bank/donations?month=YYYY-MM — bags collected in a month
export async function GET(request: Request) {
  const guard = await requireBloodBankAccess("read");
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  if (status && !BAG_STATUSES.has(status)) return bloodError("invalid_status");
  const range = status ? null : monthRange(params.get("month"));
  if (!status && !range) return bloodError("invalid_month");
  const donations = await prisma.bloodDonation.findMany({
    where: {
      tenantId: guard.access.tenantId,
      ...(status ? { status: status as Prisma.EnumBloodBagStatusFilter["equals"] } : { collectedAt: { gte: range!.start, lt: range!.end } }),
    },
    include: INCLUDE,
    orderBy: { collectedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ data: donations });
}

// POST /api/v1/blood-bank/donations
// Body: { donorId, sessionId? (mobile collection), bagNumber, collectedAt?, hivResult?, hbvResult?,
//         hcvResult?, syphilisResult? } — a new bag, in quarantine until released.
export async function POST(request: Request) {
  const guard = await requireBloodBankAccess("create");
  if (!guard.ok) return guard.response;
  const { access } = guard;
  const parsed = parseDonation(await request.json().catch(() => null));
  if (!parsed.ok) return bloodError(parsed.error);
  const v = parsed.value;
  const donor = await prisma.bloodDonor.findFirst({ where: { id: v.donorId, tenantId: access.tenantId }, select: { id: true } });
  if (!donor) return bloodError("invalid_donor");
  if (v.sessionId) {
    const session = await prisma.bloodCollectionSession.findFirst({ where: { id: v.sessionId, tenantId: access.tenantId }, select: { id: true } });
    if (!session) return bloodError("invalid_session");
  }
  try {
    const donation = await prisma.bloodDonation.create({ data: { ...v, tenantId: access.tenantId, recordedById: access.userId }, include: INCLUDE });
    await auditBlood(request, access, "blood_bank.donation_create", "blood_donation", donation.id, { bagNumber: v.bagNumber });
    return NextResponse.json({ data: donation }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return bloodError("duplicate_bag", 409);
    console.error("[POST /api/v1/blood-bank/donations]", error);
    return NextResponse.json({ error: "Failed to save the donation" }, { status: 500 });
  }
}
