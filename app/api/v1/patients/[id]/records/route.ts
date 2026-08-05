import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { MedicalRecordType } from "@prisma/client";

// Only accept valid UUIDs for FK fields; treat anything else as null
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toUuid = (v: unknown): string | null =>
  typeof v === "string" && UUID_RE.test(v) ? v : null;

const RECORD_TYPES: MedicalRecordType[] = [
  "consultation",
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

    const records = await prisma.medicalRecord.findMany({
      where: {
        patientId: id,
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
//   authorId*      – UUID of the TenantUser writing the record (required)
//   type*          – MedicalRecordType (required)
//   content*       – plain text content (required)
//   title          – optional title
//   contentHtml    – optional HTML version of content
//   stayId         – optional Stay UUID
//   isSigned       – boolean (default false)
//   signedAt       – ISO datetime (only if isSigned)
//   signedBy       – UUID of signing TenantUser
//   signatureHash  – optional hash string
//   attachments    – array of attachment objects (default [])
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
      authorId,
      type,
      content,
      title,
      contentHtml,
      stayId,
      isSigned,
      signedAt,
      signedBy,
      signatureHash,
      attachments,
    } = body;

    // ── Validate required fields ───────────────────────────────────────────
    if (!authorId || !toUuid(authorId)) {
      return NextResponse.json(
        { error: "authorId is required and must be a valid UUID", success: false },
        { status: 400 }
      );
    }
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

    // ── Create ─────────────────────────────────────────────────────────────
    const record = await prisma.medicalRecord.create({
      data: {
        patientId: id,
        authorId: authorId as string,
        type: type as MedicalRecordType,
        content: content.trim(),
        title: title || null,
        contentHtml: contentHtml || null,
        stayId: toUuid(stayId),
        isSigned: typeof isSigned === "boolean" ? isSigned : false,
        signedAt: isSigned && signedAt ? new Date(signedAt) : null,
        signedBy: isSigned ? toUuid(signedBy) : null,
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

    return NextResponse.json({ data: record, success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/patients/:id/records]", error);
    return NextResponse.json(
      { error: "Failed to create medical record", success: false },
      { status: 500 }
    );
  }
}
