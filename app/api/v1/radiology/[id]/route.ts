import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true, allergies: true } as const;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_RADIOLOGY", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;
  const exam = await prisma.examRequest.findUnique({
    where: { id },
    include: {
      patient: { select: PATIENT_SELECT },
      results: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  return NextResponse.json(exam);
}
