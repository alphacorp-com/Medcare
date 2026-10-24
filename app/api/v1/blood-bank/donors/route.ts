import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { parseDonor } from "@/lib/blood-bank/input";
import { auditBlood, bloodError, requireBloodBankAccess } from "@/lib/blood-bank/route-auth";

// GET /api/v1/blood-bank/donors?q= — donors (name or code), with their number of donations.
export async function GET(request: Request) {
  const guard = await requireBloodBankAccess("read");
  if (!guard.ok) return guard.response;
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const donors = await prisma.bloodDonor.findMany({
    where: {
      tenantId: guard.access.tenantId,
      ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: { _count: { select: { donations: true } } },
    orderBy: { fullName: "asc" },
    take: 100,
  });
  return NextResponse.json({ data: donors });
}

// POST /api/v1/blood-bank/donors
// Body: { code, fullName, sex, birthDate?, phone?, bloodGroup?, donorType (voluntary|family), patientId? }
export async function POST(request: Request) {
  const guard = await requireBloodBankAccess("create");
  if (!guard.ok) return guard.response;
  const { access } = guard;
  const parsed = parseDonor(await request.json().catch(() => null));
  if (!parsed.ok) return bloodError(parsed.error);
  if (parsed.value.patientId) {
    const patient = await prisma.patient.findFirst({ where: { id: parsed.value.patientId, tenantId: access.tenantId }, select: { id: true } });
    if (!patient) return bloodError("invalid_patient");
  }
  try {
    const donor = await prisma.bloodDonor.create({ data: { ...parsed.value, tenantId: access.tenantId } });
    await auditBlood(request, access, "blood_bank.donor_create", "blood_donor", donor.id);
    return NextResponse.json({ data: donor }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return bloodError("duplicate_code", 409);
    console.error("[POST /api/v1/blood-bank/donors]", error);
    return NextResponse.json({ error: "Failed to save the donor" }, { status: 500 });
  }
}
