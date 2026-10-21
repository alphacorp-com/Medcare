import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { MedicalRecordType } from "@prisma/client";
import { suggestInvoiceLine } from "@/lib/billing/suggestCharge";
import { completeAppointmentForStay } from "@/lib/scheduling/appointments";
import { parseDiagnosisInput } from "@/lib/diagnoses/diagnosis-input";
import { diagnosisRows, resolveDiagnoses } from "@/lib/diagnoses/diagnoses";

// Only accept valid UUIDs for FK fields; treat anything else as null
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toUuid = (v: unknown): string | null =>
  typeof v === "string" && UUID_RE.test(v) ? v : null;

const RECORD_TYPES: MedicalRecordType[] = [
  "consultation",
  "complementary_note",
  "observation",
  "surgery_report",
  "discharge_letter",
  "referral",
  "nursing_note",
  "anesthesia",
];

// ── GET /api/v1/patients/:id/records ───────────────────────────────────────
// Query params:
//   type   – optional MedicalRecordType filter
//   stayId – optional Stay UUID filter
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as MedicalRecordType | null;
    const stayId = searchParams.get("stayId");

    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found", success: false },
        { status: 404 }
      );
    }

    const records = await prisma.medicalRecord.findMany({
      where: {
        patientId: id,
        tenantId: session.user.tenantId,
        ...(type ? { type } : {}),
        ...(stayId ? { stayId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        stay: {
          select: {
            stayNumber: true,
            type: true,
            admissionDate: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: records,
      total: records.length,
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id/records]", error);
    return NextResponse.json(
      { error: "Failed to fetch medical records", success: false },
      { status: 500 }
    );
  }
}

// ── POST /api/v1/patients/:id/records ──────────────────────────────────────
// Body (all MedicalRecord writable fields):
// The author and, when signed, the signer are ALWAYS the signed-in user, and the signature
// time is the server's: authorId / signedBy / signedAt sent by the client are ignored, so
// nobody can write or sign a note in someone else's name.
//   type*          – MedicalRecordType (required)
//   content*       – plain text content (required)
//   title          – optional title
//   contentHtml    – optional HTML version of content
//   stayId         – optional Stay UUID
//   isSigned       – boolean (default false)
//   signatureHash  – optional hash string
//   attachments    – array of attachment objects (default [])
//   diagnoses      – [{ code, kind: principal|secondary, isNewCase? }] — a principal ICD-10
//                    diagnosis is required to sign a consultation (RMA3 causes of consultation)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      type,
      content,
      title,
      contentHtml,
      stayId,
      isSigned,
      signatureHash,
      attachments,
      diagnoses,
    } = body;

    // ── Validate required fields ───────────────────────────────────────────
    if (!type || !RECORD_TYPES.includes(type as MedicalRecordType)) {
      return NextResponse.json(
        {
          error: `type is required and must be one of: ${RECORD_TYPES.join(", ")}`,
          success: false,
        },
        { status: 400 }
      );
    }
    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json(
        { error: "content is required", success: false },
        { status: 400 }
      );
    }

    // ── Verify parent patient belongs to this tenant ────────────────────────
    const patient = await prisma.patient.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found", success: false },
        { status: 404 }
      );
    }

    // ── Resolve + validate the linked stay, if one was given — a bare toUuid()
    // check only confirms the format, not that it's a real stay belonging to this
    // tenant and patient. Without this, a client could attach any other tenant's
    // stayId to a record it creates, and read that stay's number/type/admission
    // date back via the `include: { stay }` below, or (once signed) trigger an
    // unscoped consultationStatus update against it further down. ────────────
    const resolvedStayId = toUuid(stayId);
    let stayActBilledAtAdmission = false;
    if (resolvedStayId) {
      const stay = await prisma.stay.findFirst({
        where: { id: resolvedStayId, tenantId: session.user.tenantId, patientId: id },
        select: { id: true, medicalActCode: true },
      });
      if (!stay) {
        return NextResponse.json({ error: "Stay not found", success: false }, { status: 404 });
      }
      stayActBilledAtAdmission = Boolean(stay.medicalActCode);
    }

    // ── Coded diagnoses: required to sign a consultation, optional otherwise ─
    const signsConsultation = type === "consultation" && isSigned === true;
    const parsedDiagnoses = parseDiagnosisInput(diagnoses, { principalRequired: signsConsultation });
    if (!parsedDiagnoses.ok) {
      return NextResponse.json({ error: "Invalid diagnoses", code: parsedDiagnoses.error, success: false }, { status: 400 });
    }
    const resolvedDiagnoses = await resolveDiagnoses(session.user.tenantId, parsedDiagnoses.value);
    if (!resolvedDiagnoses.ok) {
      return NextResponse.json(
        { error: "Unknown ICD-10 code", code: "unknown_code", codes: resolvedDiagnoses.unknownCodes, success: false },
        { status: 400 }
      );
    }

    // ── Create (the note and its diagnoses together, or neither) ───────────
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.medicalRecord.create({
        data: {
          tenantId: session.user.tenantId,
          patientId: id,
          authorId: session.user.id,
          type: type as MedicalRecordType,
          content: content.trim(),
          title: title || null,
          contentHtml: contentHtml || null,
          stayId: resolvedStayId,
          isSigned: typeof isSigned === "boolean" ? isSigned : false,
          signedAt: isSigned === true ? new Date() : null,
          signedBy: isSigned === true ? session.user.id : null,
          signatureHash: isSigned && signatureHash ? signatureHash : null,
          attachments: Array.isArray(attachments) ? attachments : [],
        },
        include: {
          stay: {
            select: {
              stayNumber: true,
              type: true,
              admissionDate: true,
            },
          },
        },
      });
      if (resolvedDiagnoses.value.length > 0) {
        await tx.diagnosis.createMany({
          data: diagnosisRows(resolvedDiagnoses.value, {
            tenantId: session.user.tenantId,
            patientId: id,
            stayId: created.stayId,
            medicalRecordId: created.id,
            context: "consultation",
            recordedById: session.user.id,
          }),
        });
      }
      return created;
    });

    const isCompletedConsultation = record.type === "consultation" && record.isSigned;

    // A stay admitted with a medical act was already billed (and paid) at admission —
    // signing the note only bills the consultation for stays/visits without one.
    const billing =
      isCompletedConsultation && !stayActBilledAtAdmission && session.user.tenantId
        ? await suggestInvoiceLine({
            tenantId: session.user.tenantId,
            patientId: id,
            stayId: record.stayId,
            sourceType: "consultation",
            sourceId: record.id,
            description: "Consultation",
            feeCode: "CONSULTATION",
            performedById: session.user.id,
          })
        : null;

    // Closes the consultation-queue loop: signing the note is what marks the doctor's
    // work on this stay as done, moving it out of the shared "waiting"/"claimed" queue.
    // Never throws — this is a side effect of documenting the consult, not a precondition.
    if (isCompletedConsultation && record.stayId) {
      try {
        await prisma.stay.update({
          where: { id: record.stayId },
          data: { consultationStatus: "completed" },
        });
        await completeAppointmentForStay(session.user.tenantId, record.stayId);
      } catch (statusError) {
        console.error("[POST /api/v1/patients/:id/records] Failed to close consultation status:", statusError);
      }
    }

    return NextResponse.json({ data: record, billing, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/patients/:id/records]", error);
    return NextResponse.json(
      { error: "Failed to create medical record", success: false },
      { status: 500 }
    );
  }
}
