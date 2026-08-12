import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { CHECKLIST_ITEMS, CHECKLIST_PHASES, ChecklistPhase, WhoChecklist } from "@/lib/surgery/checklist";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/surgeries/[id]/checklist
// Body: { phase: "signIn" | "timeOut" | "signOut", items: Record<string, boolean> }
// Sign In / Time Out are recorded while the case is still "scheduled";
// Sign Out is recorded while it's "in_progress" (before the case is completed).
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
    const { phase, items } = body as { phase: ChecklistPhase; items: Record<string, boolean> };

    if (!CHECKLIST_PHASES.includes(phase)) {
      return NextResponse.json({ error: "Invalid checklist phase" }, { status: 400 });
    }

    const existing = await prisma.surgicalProcedure.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

    const allowedStatus = phase === "signOut" ? "in_progress" : "scheduled";
    if (existing.status !== allowedStatus) {
      return NextResponse.json(
        { error: `The "${phase}" checklist can only be recorded while the case is ${allowedStatus}` },
        { status: 400 }
      );
    }

    const currentChecklist = (existing.whoChecklist ?? {}) as WhoChecklist;
    const sanitizedItems = Object.fromEntries(
      CHECKLIST_ITEMS[phase].map((key) => [key, Boolean(items?.[key])])
    );

    const updatedChecklist: WhoChecklist = {
      ...currentChecklist,
      [phase]: {
        items: sanitizedItems,
        completedAt: new Date().toISOString(),
        completedBy: session.user.id,
      },
    };

    const surgery = await prisma.surgicalProcedure.update({
      where: { id },
      data: { whoChecklist: updatedChecklist as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json(surgery);
  } catch (error) {
    console.error("Error updating checklist:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
