import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseRequiredText, SURGERY_TEXT_LIMITS } from "@/lib/surgery/validation";
import { auditClinicalAction } from "@/lib/exams/audit";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/surgeries/[id]/postpone
// Body: { reason }
// Allowed from "scheduled" only. A postponed case can later be rescheduled
// (PATCH /api/v1/surgeries/[id] with a new scheduledAt reactivates it to "scheduled").
// Each postponement and its reason is an audit line, so successive postponements are all kept.
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
    const body = await req.json();
    const reason = parseRequiredText(body?.reason, "reason", SURGERY_TEXT_LIMITS.reason);
    if (!reason.ok) {
      return NextResponse.json({ error: reason.error === "reason is required" ? "A reason is required to postpone a case" : reason.error }, { status: 400 });
    }

    const surgery = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

    if (surgery.status !== "scheduled") {
      return NextResponse.json({ error: `Cannot postpone a case with status "${surgery.status}"` }, { status: 400 });
    }

    const { count } = await prisma.surgicalProcedure.updateMany({ where: { id, status: "scheduled" }, data: { status: "postponed", statusReason: reason.value } });
    if (count === 0) return NextResponse.json({ error: "The case changed meanwhile, reload it" }, { status: 409 });

    await auditClinicalAction(session, req, "surgery.postpone", { type: "surgical_procedure", id }, { reason: reason.value, scheduledAt: surgery.scheduledAt?.toISOString() ?? null });
    return NextResponse.json(await prisma.surgicalProcedure.findUnique({ where: { id } }));
  } catch (error) {
    console.error("Error postponing surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
