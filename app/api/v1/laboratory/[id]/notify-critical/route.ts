import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";

// PATCH /api/v1/laboratory/[id]/notify-critical
// Marks the latest critical result as having been phoned/communicated to the ordering clinician.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_LAB", "update");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;

  const latestResult = await prisma.examResult.findFirst({
    where: { requestId: id },
    orderBy: { createdAt: "desc" },
  });

  if (!latestResult) {
    return NextResponse.json({ error: "No result found for this exam" }, { status: 404 });
  }
  if (!latestResult.isCritical) {
    return NextResponse.json({ error: "This result is not flagged as critical" }, { status: 400 });
  }
  if (latestResult.criticalNotifiedAt) {
    return NextResponse.json({ error: "This critical result was already notified" }, { status: 400 });
  }

  const updated = await prisma.examResult.update({
    where: { id: latestResult.id },
    data: { criticalNotifiedAt: new Date() },
  });

  return NextResponse.json(updated);
}
