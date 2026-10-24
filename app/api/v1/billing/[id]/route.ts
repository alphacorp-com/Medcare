import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recalculateInvoiceTotals } from "@/lib/billing/suggestCharge";
import { isLiveClaimItem } from "@/lib/coverage/apply";
import { isUuid } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// GET /api/v1/billing/[id] — invoice detail: patient, stay, lines (with the split between the
// free-care programmes, the payer and the patient), payments, coverage applied, the claims it is
// in, and the patient's coverages / authorizations the cashier can choose from.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await billingGuard("read");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const invoice = await prisma.patientInvoice.findFirst({
    where: { id, tenantId: guard.tenantId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, ipp: true } },
      stay: { select: { id: true, stayNumber: true, admissionDate: true, dischargeDate: true } },
      lines: { orderBy: { createdAt: "asc" }, include: { exemptionProgram: { select: { code: true, name: true } } } },
      payments: { orderBy: { initiatedAt: "desc" } },
      coverage: { include: { agreement: { include: { payer: { select: { id: true, name: true } } } } } },
      authorization: true,
      claimItems: { include: { claim: { select: { id: true, number: true, status: true } } } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const coverageOptions = await prisma.patientCoverage.findMany({
    where: { tenantId: guard.tenantId, patientId: invoice.patientId },
    include: {
      agreement: { select: { name: true, requiresAuthorization: true, payer: { select: { name: true } } } },
      authorizations: { where: { status: "active" }, orderBy: { validTo: "desc" } },
    },
    orderBy: { validFrom: "desc" },
  });

  return NextResponse.json({ ...invoice, coverageOptions, isClaimed: invoice.claimItems.some(isLiveClaimItem) });
}

// PATCH /api/v1/billing/[id] — Body: { notes?, coverageId? (null = no coverage), authorizationId? (null = none),
// status?: "cancelled" }. The payer's share is no longer typed in: it follows from the coverage
// (lib/coverage). Coverage changes are refused once the invoice is claimed to a payer.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return coverageError("invalid_body");
    if ("insuranceAmount" in body) return coverageError("insurance_amount_from_coverage");

    const invoice = await prisma.patientInvoice.findFirst({
      where: { id, tenantId: guard.tenantId },
      include: { claimItems: { select: { claimedAmount: true, rejectedAmount: true } } },
    });
    if (!invoice) return coverageError("not_found", 404);
    const claimed = invoice.claimItems.some(isLiveClaimItem);

    const data: { notes?: string | null; status?: "cancelled"; coverageId?: string | null; authorizationId?: string | null; insuranceAmount?: number } = {};
    if ("notes" in body) {
      if (body.notes !== null && (typeof body.notes !== "string" || body.notes.length > 2000)) return coverageError("invalid_notes");
      data.notes = (body.notes as string | null)?.trim() || null;
    }
    if (body.status === "cancelled") {
      if (claimed) return coverageError("invoice_claimed");
      data.status = "cancelled";
    }

    const coverageChange = "coverageId" in body || "authorizationId" in body;
    if (coverageChange) {
      if (claimed) return coverageError("invoice_claimed");
      if (invoice.status === "cancelled") return coverageError("invoice_cancelled");
      let coverageId = "coverageId" in body ? (body.coverageId as string | null) : invoice.coverageId;
      if (coverageId !== null && !isUuid(coverageId)) return coverageError("invalid_coverage");
      if (coverageId) {
        const coverage = await prisma.patientCoverage.findFirst({ where: { id: coverageId, tenantId: guard.tenantId, patientId: invoice.patientId }, select: { id: true } });
        if (!coverage) return coverageError("invalid_coverage");
        coverageId = coverage.id;
      }
      let authorizationId = "authorizationId" in body ? (body.authorizationId as string | null) : coverageId === invoice.coverageId ? invoice.authorizationId : null;
      if (authorizationId !== null && !isUuid(authorizationId)) return coverageError("invalid_authorization");
      if (authorizationId) {
        if (!coverageId) return coverageError("invalid_authorization");
        const authorization = await prisma.coverageAuthorization.findFirst({ where: { id: authorizationId, tenantId: guard.tenantId, coverageId }, select: { id: true } });
        if (!authorization) return coverageError("invalid_authorization");
        authorizationId = authorization.id;
      }
      data.coverageId = coverageId;
      data.authorizationId = authorizationId;
      // No coverage any more: no payer share (the recalculation would otherwise keep the old amount
      // as a pre-coverage manual one).
      if (!coverageId) data.insuranceAmount = 0;
    }

    await prisma.patientInvoice.update({ where: { id }, data });
    // Recomputes the split and the status, then releases what the invoice held if now settled.
    const updated = await recalculateInvoiceTotals(id);

    if (coverageChange) {
      await auditCoverage(request, guard, "billing.invoice_coverage_change", "patient_invoice", id, {
        from: { coverageId: invoice.coverageId, authorizationId: invoice.authorizationId, insuranceAmount: Number(invoice.insuranceAmount) },
        to: { coverageId: updated.coverageId, authorizationId: updated.authorizationId, insuranceAmount: Number(updated.insuranceAmount), coverageStatus: updated.coverageStatus },
      });
    }
    if (data.status === "cancelled") await auditCoverage(request, guard, "billing.invoice_cancel", "patient_invoice", id, { subtotal: Number(invoice.subtotal) });
    return NextResponse.json(updated);
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/billing/[id]");
  }
}
