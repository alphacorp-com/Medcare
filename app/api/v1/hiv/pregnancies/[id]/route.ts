import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { REFERRAL_SOURCES, isUuid } from "@/lib/hiv/input";
import { auditHiv, hivBadRequest, hivNotFound, requireHivAccess } from "@/lib/hiv/route-auth";

// ── PUT /api/v1/hiv/pregnancies/:id ─────────────────────────────────────────
// Body: { hivKnownPositiveAtEntry, onArtAtEntry, hbvKnownPositiveAtEntry, referralSource }
// — PMTCT status at the first antenatal contact (own table, HIV-only) and the community
// referral of the pregnancy.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireHivAccess("update");
    if (!guard.ok) return guard.response;
    const { access } = guard;
    const { id } = await params;
    if (!isUuid(id)) return hivNotFound();
    const pregnancy = await prisma.pregnancy.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true, patientId: true } });
    if (!pregnancy) return hivNotFound();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return hivBadRequest("invalid_body");
    const flags = ["hivKnownPositiveAtEntry", "onArtAtEntry", "hbvKnownPositiveAtEntry"] as const;
    if (flags.some((k) => typeof body[k] !== "boolean")) return hivBadRequest("invalid_body");
    const referral = body.referralSource ?? "none";
    if (!(REFERRAL_SOURCES as readonly unknown[]).includes(referral)) return hivBadRequest("invalid_referral");
    // On ART at entry implies a known HIV-positive status.
    const status = {
      hivKnownPositiveAtEntry: body.hivKnownPositiveAtEntry === true || body.onArtAtEntry === true,
      onArtAtEntry: body.onArtAtEntry === true,
      hbvKnownPositiveAtEntry: body.hbvKnownPositiveAtEntry === true,
    };

    const saved = await prisma.$transaction(async (tx) => {
      await tx.pregnancy.update({ where: { id: pregnancy.id }, data: { referralSource: referral as (typeof REFERRAL_SOURCES)[number] } });
      return tx.pmtctPregnancyStatus.upsert({
        where: { pregnancyId: pregnancy.id },
        update: { ...status, updatedById: access.userId },
        create: { tenantId: access.tenantId, pregnancyId: pregnancy.id, ...status, updatedById: access.userId },
      });
    });
    await auditHiv(request, access, "hiv.pmtct_status.update", "pregnancy", pregnancy.id, pregnancy.patientId);
    return NextResponse.json({ data: { ...saved, referralSource: referral }, success: true });
  } catch (error) {
    console.error("[PUT /api/v1/hiv/pregnancies/:id]", error);
    return NextResponse.json({ error: "Failed to save the PMTCT status", success: false }, { status: 500 });
  }
}
