import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PATCH /api/v1/laboratory/[id]/collect — marks the sample as collected: requested -> in_progress
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const exam = await prisma.examRequest.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  if (exam.status !== "requested") {
    return NextResponse.json({ error: `Cannot collect a sample for status "${exam.status}"` }, { status: 400 });
  }

  const updated = await prisma.examRequest.update({
    where: { id },
    data: { status: "in_progress" },
  });

  return NextResponse.json(updated);
}
