import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isUuid } from "@/lib/coverage/input";
import { POLICY_INCLUDE } from "@/lib/coverage/policies";
import { billingGuard, coverageError } from "@/lib/coverage/route-auth";

// GET /api/v1/coverage/policies?agreementId=&memberNumber= — the membership with that member number
// under that convention (exact match), with its beneficiaries: to add a dependant to it.
export async function GET(request: Request) {
  const guard = await billingGuard("read");
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const agreementId = params.get("agreementId");
  const memberNumber = params.get("memberNumber")?.trim() ?? "";
  if (!isUuid(agreementId)) return coverageError("invalid_agreement");
  if (!memberNumber || memberNumber.length > 60) return coverageError("invalid_member_number");
  const policy = await prisma.coveragePolicy.findFirst({ where: { tenantId: guard.tenantId, agreementId, memberNumber }, include: POLICY_INCLUDE });
  return NextResponse.json({ data: policy });
}
