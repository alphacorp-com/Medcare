import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// ── GET /api/v1/patients/:id ──────────────────────────────────────────────────
// Returns full patient record with stays, prescriptions and exam requests.
export async function GET(
  _request: Request,
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

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        stays: {
          orderBy: { admissionDate: "desc" },
        },
        prescriptions: {
          orderBy: { prescribedAt: "desc" },
        },
        examRequests: {
          orderBy: { requestedAt: "desc" },
          include: { results: true },
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found", success: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: patient, success: true });
  } catch (error) {
    console.error("[GET /api/v1/patients/:id]", error);
    return NextResponse.json(
      { error: "Failed to fetch patient", success: false },
      { status: 500 }
    );
  }
}

// ── PATCH /api/v1/patients/:id ────────────────────────────────────────────────
// Accepts partial Patient fields. Dates are parsed server-side.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    const assignable = [
      "firstName",
      "lastName",
      "maidenName",
      "birthPlace",
      "gender",
      "nationality",
      "maritalStatus",
      "bloodGroup",
      "nss",
      "phone",
      "email",
      "address",
      "emergencyContact",
      "allergies",
      "chronicConditions",
      "isDeceased",
    ] as const;

    for (const key of assignable) {
      if (key in body) data[key] = body[key];
    }

    if ("birthDate" in body && body.birthDate) {
      data.birthDate = new Date(body.birthDate);
    }

    if ("deceasedAt" in body && body.deceasedAt) {
      data.deceasedAt = new Date(body.deceasedAt);
    }

    if ("gdprConsent" in body) {
      data.gdprConsent = Boolean(body.gdprConsent);
      data.gdprConsentAt = body.gdprConsent ? new Date() : null;
    }

    const patient = await prisma.patient.update({
      where: { id },
      data,
    });

    return NextResponse.json({ data: patient, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/patients/:id]", error);
    return NextResponse.json(
      { error: "Failed to update patient", success: false },
      { status: 500 }
    );
  }
}
