import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkOnPremLicenseGuard } from "@/lib/onprem-license/guard";
import { computeFingerprint } from "@/lib/onprem-license/fingerprint";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.isSystemAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const license = await prisma.onPremLicense.findUnique({ where: { id: "current" } });
  const guard = await checkOnPremLicenseGuard();
  const { short: fingerprint } = computeFingerprint();

  return NextResponse.json({
    license: license
      ? {
          tier: license.tier,
          modules: license.modules,
          maxUsers: license.maxUsers,
          maxBeds: license.maxBeds,
          validFrom: license.validFrom,
          validUntil: license.validUntil,
          gracePeriodDays: license.gracePeriodDays,
          channel: license.channel,
          appliedAt: license.appliedAt,
        }
      : null,
    guard,
    fingerprint,
  });
}
