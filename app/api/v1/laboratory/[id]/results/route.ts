import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeIsCritical, ResultParameter } from "@/lib/laboratory/results";

// POST /api/v1/laboratory/[id]/results
// Body: { parameters: [{ name, value, unit, referenceRange, flag }], isCritical? }
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { parameters, isCritical } = body as { parameters?: ResultParameter[]; isCritical?: boolean };

    if (!parameters?.length) {
      return NextResponse.json({ error: "At least one parameter is required" }, { status: 400 });
    }

    const exam = await prisma.examRequest.findUnique({ where: { id } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status !== "in_progress") {
      return NextResponse.json({ error: `Cannot enter results for status "${exam.status}"` }, { status: 400 });
    }

    const existingUnvalidated = await prisma.examResult.findFirst({
      where: { requestId: id, validatedAt: null },
    });
    if (existingUnvalidated) {
      return NextResponse.json(
        { error: "A result is already awaiting validation for this exam" },
        { status: 400 }
      );
    }

    const result = await prisma.examResult.create({
      data: {
        requestId: id,
        patientId: exam.patientId,
        performerId: session.user.id,
        resultData: { parameters } as any,
        isCritical: computeIsCritical(parameters, isCritical),
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error entering lab results:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
