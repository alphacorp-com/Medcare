import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isPhaseComplete, WhoChecklist } from "@/lib/surgery/checklist";

// PATCH /api/v1/surgeries/[id]/complete
// Body: { surgicalReport, anesthesiaReport?, complications? }
// Requires the Sign Out checklist phase to be complete and a non-empty report.
// If the case is linked to a Stay, also files a signed "surgery_report" MedicalRecord.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { surgicalReport, anesthesiaReport, complications } = body as {
      surgicalReport?: string;
      anesthesiaReport?: string;
      complications?: string[];
    };

    if (!surgicalReport?.trim()) {
      return NextResponse.json({ error: "A surgical report is required to complete the case" }, { status: 400 });
    }

    const surgery = await prisma.surgicalProcedure.findUnique({ where: { id } });
    if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });

    if (surgery.status !== "in_progress") {
      return NextResponse.json({ error: `Cannot complete a case with status "${surgery.status}"` }, { status: 400 });
    }

    const checklist = (surgery.whoChecklist ?? {}) as WhoChecklist;
    if (!isPhaseComplete("signOut", checklist.signOut)) {
      return NextResponse.json({ error: "The Sign Out checklist must be completed before finishing" }, { status: 400 });
    }

    const endedAt = new Date();

    const [updated] = await prisma.$transaction([
      prisma.surgicalProcedure.update({
        where: { id },
        data: {
          status: "completed",
          endedAt,
          surgicalReport,
          anesthesiaReport: anesthesiaReport || null,
          complications: complications ?? [],
        },
      }),
      ...(surgery.stayId
        ? [
            prisma.medicalRecord.create({
              data: {
                patientId: surgery.patientId,
                stayId: surgery.stayId,
                authorId: session.user.id,
                type: "surgery_report",
                title: surgery.procedureLabel,
                content: surgicalReport,
                isSigned: true,
                signedAt: endedAt,
                signedBy: session.user.id,
              },
            }),
          ]
        : []),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error completing surgery:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
