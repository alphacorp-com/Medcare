import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addClaimInvoices, closeClaim, deleteDraftClaim, removeClaimItem, submitClaim } from "@/lib/coverage/claims";
import { isUuid } from "@/lib/coverage/input";
import { auditCoverage, billingGuard, coverageError, handleCoverageError } from "@/lib/coverage/route-auth";

// GET /api/v1/billing/claims/[id] — the claim, its items (invoice, patient, member number, amounts)
// and the payer settlements allocated to it.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await billingGuard("read");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  const claim = await prisma.insuranceClaim.findFirst({
    where: { id, tenantId: guard.tenantId },
    include: {
      payer: { select: { id: true, name: true, code: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          invoice: {
            select: {
              id: true, createdAt: true, subtotal: true, insuranceAmount: true, patientAmount: true,
              patient: { select: { firstName: true, lastName: true, ipp: true } },
              coverage: { select: { relationship: true, beneficiaryNumber: true, policy: { select: { memberNumber: true, holderName: true, agreement: { select: { name: true } } } } } },
              authorization: { select: { number: true } },
            },
          },
          allocations: { orderBy: { createdAt: "asc" }, select: { id: true, amount: true, reversedAt: true, payment: { select: { id: true, receivedAt: true, reference: true } } } },
          rejections: { orderBy: { createdAt: "asc" }, select: { id: true, amount: true, reason: true, chargedToPatient: true, createdAt: true, reversedAt: true, reversalReason: true } },
        },
      },
      payments: { orderBy: { receivedAt: "desc" } },
    },
  });
  if (!claim) return coverageError("not_found", 404);
  return NextResponse.json({ data: claim });
}

// PATCH /api/v1/billing/claims/[id] — Body: { action: "submit" | "close" | "add" | "remove", invoiceIds?, itemId? }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("update");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { action?: unknown; invoiceIds?: unknown; itemId?: unknown } | null;
    switch (body?.action) {
      case "submit":
        await submitClaim(guard.tenantId, id);
        break;
      case "close":
        await closeClaim(guard.tenantId, id);
        break;
      case "add": {
        if (!Array.isArray(body.invoiceIds) || body.invoiceIds.length === 0 || body.invoiceIds.length > 500 || !body.invoiceIds.every(isUuid)) return coverageError("invalid_invoices");
        await addClaimInvoices(guard.tenantId, id, [...new Set(body.invoiceIds as string[])]);
        break;
      }
      case "remove":
        if (!isUuid(body.itemId)) return coverageError("invalid_item");
        await removeClaimItem(guard.tenantId, id, body.itemId);
        break;
      default:
        return coverageError("invalid_action");
    }
    await auditCoverage(request, guard, `billing.claim_${body.action}`, "insurance_claim", id, { invoiceIds: body.invoiceIds, itemId: body.itemId });
    return NextResponse.json({ data: { id, action: body.action } });
  } catch (error) {
    return handleCoverageError(error, "PATCH /api/v1/billing/claims/[id]");
  }
}

// DELETE /api/v1/billing/claims/[id] — a draft claim only; its invoices are released.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await billingGuard("delete");
    if (!guard.ok) return guard.response;
    const { id } = await context.params;
    await deleteDraftClaim(guard.tenantId, id);
    await auditCoverage(request, guard, "billing.claim_delete", "insurance_claim", id, {});
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    return handleCoverageError(error, "DELETE /api/v1/billing/claims/[id]");
  }
}
