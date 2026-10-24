import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { suggestInvoiceLine } from "@/lib/billing/suggestCharge";
import { ageInDaysAt } from "@/lib/patients/age";
import { parseAntenatalExtras } from "@/lib/maternity/input";
import { createImmunizationInTx, resolveVaccineStockLot } from "@/lib/epi/record-dose";
import { StockError, stockErrorResponse } from "@/lib/stock/movements";
import { ensureTdAntigen } from "@/lib/maternity/td";

const toNumber = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const badRequest = (code: string) => NextResponse.json({ error: code, code }, { status: 400 });

// POST /api/v1/maternity/pregnancies/[id]/visits
// Body: { gestationalAgeWeeks, bloodPressureSystolic?, bloodPressureDiastolic?, weight?,
//         fundalHeightCm?, fetalHeartRate?, ironFolateGiven?, malariaPreventionGiven?, notes?,
//         strategy? (fixed|outreach), hemoglobinGPerDl?, td?: { doseNumber 1-5, stockLotId?, lotNumber? } }
// A Td dose is recorded in the vaccination register (Immunization, antigen of the TD group) in
// the same transaction as the visit: the register stays the source of truth for the dose rank,
// lot and AEFI. A Td article managed in stock needs its lot; otherwise the lot is free text.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "create");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "A facility account is required" }, { status: 403 });

  const { id } = await context.params;

  try {
    const pregnancy = await prisma.pregnancy.findFirst({
      where: { id, tenantId },
      select: { id: true, patientId: true, status: true, patient: { select: { birthDate: true } } },
    });
    if (!pregnancy) return NextResponse.json({ error: "Pregnancy not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const { gestationalAgeWeeks } = (body ?? {}) as { gestationalAgeWeeks?: number };
    if (gestationalAgeWeeks === undefined || gestationalAgeWeeks === null) {
      return NextResponse.json({ error: "gestationalAgeWeeks is required" }, { status: 400 });
    }
    const extras = parseAntenatalExtras(body);
    if (!extras.ok) return badRequest(extras.error);
    const { strategy, hemoglobinGPerDl, td } = extras.value;

    // Td: the antigen of the TD group (created on first use), and its stock lot if managed.
    const tdAntigen = td ? await ensureTdAntigen(tenantId) : null;
    let tdLot: { id: string; itemId: string } | null = null;
    if (td && tdAntigen) {
      const lotCheck = await resolveVaccineStockLot(tenantId, tdAntigen.code, td.stockLotId);
      if (!lotCheck.ok) return badRequest(lotCheck.code);
      tdLot = lotCheck.lot;
    }

    const now = new Date();
    let visit;
    try {
      visit = await prisma.$transaction(async (tx) => {
        const visitCount = await tx.antenatalVisit.count({ where: { pregnancyId: id } });
        let tdImmunizationId: string | null = null;
        if (td && tdAntigen) {
          const immunizationId = randomUUID();
          await createImmunizationInTx(
            tx,
            {
              id: immunizationId,
              tenantId,
              patientId: pregnancy.patientId,
              antigenCode: tdAntigen.code,
              antigenName: tdAntigen.nameFr,
              doseNumber: td.doseNumber,
              administeredAt: now,
              administeredById: session.user.id,
              ageInDaysAtAdministration: ageInDaysAt(pregnancy.patient.birthDate, now),
              lotNumber: td.lotNumber,
              strategy,
              notes: "CPN",
            },
            tdLot,
            session.user.id
          );
          tdImmunizationId = immunizationId;
        }
        return tx.antenatalVisit.create({
          data: {
            tenantId,
            pregnancyId: id,
            visitNumber: visitCount + 1,
            visitDate: now,
            gestationalAgeWeeks: Number(gestationalAgeWeeks),
            performedById: session.user.id,
            bloodPressureSystolic: toNumber(body.bloodPressureSystolic),
            bloodPressureDiastolic: toNumber(body.bloodPressureDiastolic),
            weight: toNumber(body.weight),
            fundalHeightCm: toNumber(body.fundalHeightCm),
            fetalHeartRate: toNumber(body.fetalHeartRate),
            ironFolateGiven: Boolean(body.ironFolateGiven),
            // Kept for the existing reports: true whenever a Td dose was given.
            tetanusVaccineGiven: Boolean(td) || Boolean(body.tetanusVaccineGiven),
            malariaPreventionGiven: Boolean(body.malariaPreventionGiven),
            itnGiven: body.itnGiven === true,
            notes: body.notes || null,
            strategy,
            hemoglobinGPerDl,
            tdImmunizationId,
          },
        });
      });
    } catch (error) {
      if (error instanceof StockError) {
        const { status, body: errorBody } = stockErrorResponse(error);
        return NextResponse.json(errorBody, { status });
      }
      throw error;
    }

    const billing = await suggestInvoiceLine({
      tenantId,
      patientId: pregnancy.patientId,
      stayId: null,
      sourceType: "antenatal_visit",
      sourceId: visit.id,
      description: `Consultation prénatale (CPN ${visit.visitNumber})`,
      feeCode: "CPN_VISIT",
      performedById: session.user.id,
    });

    return NextResponse.json({ ...visit, billing }, { status: 201 });
  } catch (error) {
    console.error("Error creating antenatal visit:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
