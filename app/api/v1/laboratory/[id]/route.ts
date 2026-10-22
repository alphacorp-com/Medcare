import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { loadHivResultAccess, redactConfidentialExams } from "@/lib/hiv/confidential-results";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true, gender: true } as const;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_LAB", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await context.params;
  // Scoped to this module's exam type too: the module permission only covers its own
  // exams, so an id from the other module must not be readable here.
  const exam = await prisma.examRequest.findFirst({
    where: { id, tenantId: session.user.tenantId, type: "biology" },
    include: {
      patient: { select: PATIENT_SELECT },
      results: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const access = session.user.tenantId ? await loadHivResultAccess(session, session.user.tenantId) : { canSee: true, confidentialCodes: new Set<string>() };
  return NextResponse.json(redactConfidentialExams([exam], access)[0]);
}
