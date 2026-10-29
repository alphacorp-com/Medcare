import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireModulePermission } from "@/lib/permissions";
import { getRadiologySettings } from "@/lib/radiology/settings";
import { viewerUrl } from "@/lib/radiology/safety";

const PATIENT_SELECT = { id: true, firstName: true, lastName: true, ipp: true, allergies: true, gender: true } as const;

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
  // Scoped to this module's exam type too: the module permission only covers its own
  // exams, so an id from the other module must not be readable here.
  const exam = await prisma.examRequest.findFirst({
    where: { id, tenantId: session.user.tenantId, type: "radiology" },
    include: {
      patient: { select: PATIENT_SELECT },
      results: { orderBy: { createdAt: "desc" }, include: { addenda: { orderBy: { createdAt: "asc" } } } },
    },
  });

  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const [device, settings] = await Promise.all([
    exam.deviceId ? prisma.imagingDevice.findFirst({ where: { id: exam.deviceId, tenantId: session.user.tenantId }, select: { code: true, label: true } }) : null,
    getRadiologySettings(session.user.tenantId),
  ]);
  return NextResponse.json({
    ...exam,
    device,
    // Link to the images in the facility's PACS viewer, when one is configured.
    viewerUrl: viewerUrl(settings.pacsViewerUrlTemplate, exam.accessionNumber),
  });
}
