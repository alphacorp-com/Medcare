import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/radiology/[id]/start — patient has arrived, images are being acquired: scheduled -> in_progress
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_RADIOLOGY", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;
  const exam = await prisma.examRequest.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  if (exam.status !== "scheduled") {
    return NextResponse.json({ error: `Cannot start an exam with status "${exam.status}"` }, { status: 400 });
  }

  const updated = await prisma.examRequest.update({
    where: { id },
    data: { status: "in_progress" },
  });

  return NextResponse.json(updated);
}
