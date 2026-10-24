import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseBagUpdate } from "@/lib/blood-bank/input";
import { auditBlood, bloodError, requireBloodBankAccess } from "@/lib/blood-bank/route-auth";

// PATCH /api/v1/blood-bank/donations/[id]
// Body: { action: "tests", hivResult?, hbvResult?, hcvResult?, syphilisResult? }
//     | { action: "release" }                      quarantine → available (4 tests negative)
//     | { action: "serve", at? }                   available → served
//     | { action: "transfuse", at?, recipientPatientId? }
//     | { action: "destroy", at?, reason }
// The update is conditional on the status read, so two concurrent actions cannot both apply.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireBloodBankAccess("update");
  if (!guard.ok) return guard.response;
  const { access } = guard;
  const { id } = await context.params;
  const bag = await prisma.bloodDonation.findFirst({
    where: { id, tenantId: access.tenantId },
    select: { status: true, collectedAt: true, hivResult: true, hbvResult: true, hcvResult: true, syphilisResult: true },
  });
  if (!bag) return bloodError("not_found", 404);
  const parsed = parseBagUpdate(await request.json().catch(() => null), bag);
  if (!parsed.ok) return bloodError(parsed.error);
  const u = parsed.value;

  if (u.action === "transfuse" && u.recipientPatientId) {
    const recipient = await prisma.patient.findFirst({ where: { id: u.recipientPatientId, tenantId: access.tenantId }, select: { id: true } });
    if (!recipient) return bloodError("invalid_patient");
  }
  const data =
    u.action === "tests"
      ? u.results
      : u.action === "release"
        ? { status: "available" as const }
        : u.action === "serve"
          ? { status: "served" as const, servedAt: u.at }
          : u.action === "transfuse"
            ? { status: "transfused" as const, transfusedAt: u.at, recipientPatientId: u.recipientPatientId }
            : { status: "destroyed" as const, destroyedAt: u.at, destructionReason: u.reason };

  const updated = await prisma.bloodDonation.updateMany({ where: { id, tenantId: access.tenantId, status: bag.status }, data });
  if (updated.count === 0) return bloodError("bag_changed", 409);
  await auditBlood(request, access, `blood_bank.donation_${u.action}`, "blood_donation", id, u.action === "tests" ? { results: u.results } : {});
  return NextResponse.json({ data: await prisma.bloodDonation.findUnique({ where: { id } }) });
}
