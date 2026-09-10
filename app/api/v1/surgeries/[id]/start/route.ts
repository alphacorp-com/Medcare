import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isPhaseComplete, WhoChecklist } from "@/lib/surgery/checklist";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/surgeries/[id]/start
// Requires the Sign In and Time Out checklist phases to be complete.
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
  const surgery = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

  if (surgery.status !== "scheduled") {
    return NextResponse.json({ error: `Cannot start a case with status "${surgery.status}"` }, { status: 400 });
  }

  const checklist = (surgery.whoChecklist ?? {}) as WhoChecklist;

  if (!isPhaseComplete("signIn", checklist.signIn)) {
    return NextResponse.json({ error: "The Sign In checklist must be completed before starting" }, { status: 400 });
  }
  if (!isPhaseComplete("timeOut", checklist.timeOut)) {
    return NextResponse.json({ error: "The Time Out checklist must be completed before starting" }, { status: 400 });
  }

  const updated = await prisma.surgicalProcedure.update({
    where: { id },
    data: { status: "in_progress", startedAt: new Date() },
  });

  return NextResponse.json(updated);
}
