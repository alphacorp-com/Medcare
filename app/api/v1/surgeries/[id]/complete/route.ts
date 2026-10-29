import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isPhaseComplete, WhoChecklist } from "@/lib/surgery/checklist";
import { parseComplications, parseOperativeTimes, parseOptionalText, parseRequiredText, parseSupplies, SURGERY_TEXT_LIMITS } from "@/lib/surgery/validation";
import { auditClinicalAction } from "@/lib/exams/audit";
import { requireModulePermission } from "@/lib/permissions";
import { suggestInvoiceLine, suggestInvoiceLines, type ChargeLineInput } from "@/lib/billing/suggestCharge";
import { consumeStock, lockItem, StockError, stockErrorResponse } from "@/lib/stock/movements";

function slugifyProcedure(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// PATCH /api/v1/surgeries/[id]/complete
// Body: { surgicalReport, anesthesiaReport?, complications?, anesthesiaStartAt?, incisionAt?,
//         closureAt?, anesthesiaEndAt?, supplies? ([{ kind, itemId?, itemName?, quantity, lotNumber?,
//         serialNumber?, manufacturer? }]) }
// Requires the Sign Out checklist phase to be complete and a non-empty report. The operative
// report is signed: only the operating surgeon of the case completes it.
// In the same transaction: the stock articles used leave the stock (FEFO, one traced line per lot
// taken), the implants from outside are traced by lot / serial number, and, if the case is linked
// to a Stay, a signed "surgery_report" MedicalRecord is filed. The stock articles used are billed
// with the procedure.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_SURGERY", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const report = parseRequiredText(body.surgicalReport, "surgicalReport", SURGERY_TEXT_LIMITS.surgicalReport);
    if (!report.ok) {
      return NextResponse.json({ error: report.error === "surgicalReport is required" ? "A surgical report is required to complete the case" : report.error }, { status: 400 });
    }
    const anesthesia = parseOptionalText(body.anesthesiaReport, "anesthesiaReport", SURGERY_TEXT_LIMITS.anesthesiaReport);
    if (!anesthesia.ok) return NextResponse.json({ error: anesthesia.error }, { status: 400 });
    const complications = parseComplications(body.complications);
    if (!complications.ok) return NextResponse.json({ error: complications.error }, { status: 400 });
    const supplies = parseSupplies(body.supplies);
    if (!supplies.ok) return NextResponse.json({ error: supplies.error }, { status: 400 });

    const surgery = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

    if (surgery.status !== "in_progress") {
      return NextResponse.json({ error: `Cannot complete a case with status "${surgery.status}"` }, { status: 400 });
    }
    if (surgery.surgeonId !== session.user.id) {
      return NextResponse.json({ error: "Only the operating surgeon can sign the operative report" }, { status: 403 });
    }

    const checklist = (surgery.whoChecklist ?? {}) as WhoChecklist;
    if (!isPhaseComplete("signOut", checklist.signOut)) {
      return NextResponse.json({ error: "The Sign Out checklist must be completed before finishing" }, { status: 400 });
    }

    const endedAt = new Date();
    const times = parseOperativeTimes(body, surgery.startedAt, endedAt);
    if (!times.ok) return NextResponse.json({ error: times.error }, { status: 400 });
    const tenantId = session.user.tenantId;
    if (supplies.value.some((s) => s.itemId) && !tenantId) {
      return NextResponse.json({ error: "A facility account is required to take articles out of stock" }, { status: 403 });
    }
    // Stock articles taken out, for billing after the commit: supply line id → article.
    const billed: { supplyId: string; itemId: string; itemName: string; quantity: number }[] = [];

    // Conditional on "in_progress": a second click or a concurrent completion files nothing twice.
    const completed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.surgicalProcedure.updateMany({
        where: { id, status: "in_progress" },
        data: {
          status: "completed",
          endedAt,
          surgicalReport: report.value,
          anesthesiaReport: anesthesia.value,
          complications: complications.value,
          ...times.value,
        },
      });
      if (count === 0) return false;
      for (const supply of supplies.value) {
        if (supply.itemId) {
          // Locks the article (and checks it belongs to the facility), then FEFO.
          const item = await lockItem(tx, tenantId!, supply.itemId);
          const taken = await consumeStock(
            tx,
            {
              tenantId: tenantId!,
              userId: session.user.id,
              itemId: item.id,
              quantity: supply.quantity,
              type: "dispensing",
              sourceType: "surgery",
              sourceId: id,
              reason: `Bloc : ${surgery.procedureLabel}`.slice(0, 255),
              occurredAt: endedAt,
            },
            item
          );
          for (const allocation of taken.allocations) {
            const row = await tx.surgicalSupplyUse.create({
              data: {
                tenantId,
                surgeryId: id,
                kind: supply.kind,
                itemId: item.id,
                itemName: item.name,
                quantity: allocation.quantity,
                lotNumber: allocation.lotNumber,
                serialNumber: supply.serialNumber,
                manufacturer: supply.manufacturer,
                recordedById: session.user.id,
              },
            });
            billed.push({ supplyId: row.id, itemId: item.id, itemName: item.name, quantity: allocation.quantity });
          }
        } else {
          await tx.surgicalSupplyUse.create({
            data: {
              tenantId,
              surgeryId: id,
              kind: supply.kind,
              itemName: supply.itemName!,
              quantity: supply.quantity,
              lotNumber: supply.lotNumber,
              serialNumber: supply.serialNumber,
              manufacturer: supply.manufacturer,
              recordedById: session.user.id,
            },
          });
        }
      }
      if (surgery.stayId) {
        await tx.medicalRecord.create({
          data: {
            tenantId: session.user.tenantId,
            patientId: surgery.patientId,
            stayId: surgery.stayId,
            authorId: session.user.id,
            type: "surgery_report",
            title: surgery.procedureLabel,
            content: report.value,
            isSigned: true,
            signedAt: endedAt,
            signedBy: session.user.id,
          },
        });
      }
      return true;
    }, { timeout: 30_000 }); // dozens of stock lines may be taken out in one completion
    if (!completed) return NextResponse.json({ error: "The case changed meanwhile, reload it" }, { status: 409 });

    const billing = tenantId
      ? await suggestInvoiceLine({
          tenantId,
          patientId: surgery.patientId,
          stayId: surgery.stayId,
          sourceType: "surgery",
          sourceId: surgery.id,
          description: surgery.procedureLabel,
          feeCode: surgery.procedureCode ?? slugifyProcedure(surgery.procedureLabel),
          performedById: session.user.id,
        })
      : null;

    // The stock articles used, at their stock price, on the same invoice.
    if (tenantId && billed.length > 0) {
      const prices = new Map(
        (await prisma.medicationInventory.findMany({ where: { tenantId, id: { in: billed.map((b) => b.itemId) } }, select: { id: true, unitPrice: true } })).map((i) => [i.id, Number(i.unitPrice ?? 0)])
      );
      const itemOf = new Map(billed.map((b) => [b.supplyId, b.itemId]));
      const lines: ChargeLineInput[] = billed.map((b) => ({
        sourceType: "pharmacy_dispensation",
        sourceId: b.supplyId,
        description: `${b.itemName} (bloc opératoire)`,
        quantity: b.quantity,
        feeCode: b.itemId,
      }));
      await suggestInvoiceLines(tenantId, surgery.patientId, surgery.stayId, session.user.id, lines, (line) => prices.get(itemOf.get(line.sourceId) ?? "") ?? 0);
    }

    await auditClinicalAction(session, req, "surgery.complete", { type: "surgical_procedure", id }, {
      complications: complications.value,
      reportFiled: Boolean(surgery.stayId),
      supplies: supplies.value.length,
      operativeTimes: Object.fromEntries(Object.entries(times.value).map(([k, v]) => [k, v.toISOString()])),
    });
    const updated = await prisma.surgicalProcedure.findUnique({ where: { id } });
    return NextResponse.json({ ...updated, billing });
  } catch (error) {
    if (error instanceof StockError) {
      const { status, body } = stockErrorResponse(error);
      return NextResponse.json(body, { status });
    }
    console.error("Error completing surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
