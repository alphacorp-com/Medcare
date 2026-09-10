import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// ── GET /api/v1/patients ──────────────────────────────────────────────────────
// Query params:
//   q       – full-text search across lastName, firstName, ipp, nss
//   status  – "active" | "deceased" (default: active)
//   page    – pagination page (default: 1)
//   limit   – results per page (default: 50)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const status = searchParams.get("status") ?? "active";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "50", 10));

    const isDeceased = status === "deceased";

    const where = {
      tenantId: session.user.tenantId,
      isDeceased,
      ...(q
        ? {
            OR: [
              { lastName: { contains: q, mode: "insensitive" as const } },
              { firstName: { contains: q, mode: "insensitive" as const } },
              { ipp: { contains: q, mode: "insensitive" as const } },
              { nss: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        select: {
          id: true,
          ipp: true,
          lastName: true,
          firstName: true,
          gender: true,
          birthDate: true,
          bloodGroup: true,
          phone: true,
          email: true,
          isDeceased: true,
          createdAt: true,
          stays: {
            orderBy: { admissionDate: "desc" },
            take: 1,
            select: { status: true, admissionDate: true },
          },
        },
        orderBy: { lastName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patient.count({ where }),
    ]);

    return NextResponse.json({ data: patients, total, page, limit, success: true });
  } catch (error) {
    console.error("[GET /api/v1/patients]", error);
    return NextResponse.json(
      { error: "Failed to fetch patients", success: false },
      { status: 500 }
    );
  }
}

// ── POST /api/v1/patients ─────────────────────────────────────────────────────
// Body: { firstName, lastName, birthDate, gender, phone?, email?, address?,
//         nss?, bloodGroup?, maidenName?, birthPlace?, emergencyContact?,
//         allergies?, chronicConditions?, gdprConsent? }
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const body = await request.json();

    const {
      firstName,
      lastName,
      birthDate,
      gender,
      phone,
      email,
      address,
      nss,
      bloodGroup,
      maidenName,
      birthPlace,
      emergencyContact,
      allergies,
      chronicConditions,
      gdprConsent,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !birthDate || !gender) {
      return NextResponse.json(
        { error: "firstName, lastName, birthDate, and gender are required", success: false },
        { status: 400 }
      );
    }

    // Generate IPP: "10" + 7-digit zero-padded count+1 (scoped to tenant since
    // Patient.ipp is unique per-tenant, not globally)
    const count = await prisma.patient.count({
      where: { tenantId: session.user.tenantId },
    });
    const ipp = `10${String(count + 1).padStart(7, "0")}`;

    const patient = await prisma.patient.create({
      data: {
        tenantId: session.user.tenantId,
        ipp,
        firstName,
        lastName,
        birthDate: new Date(birthDate),
        gender,
        phone: phone ?? null,
        email: email ?? null,
        address: address ?? null,
        nss: nss || null,
        bloodGroup: bloodGroup || null,
        maidenName: maidenName ?? null,
        birthPlace: birthPlace ?? null,
        emergencyContact: emergencyContact ?? {},
        allergies: allergies ?? [],
        chronicConditions: chronicConditions ?? [],
        gdprConsent: gdprConsent ?? false,
        gdprConsentAt: gdprConsent ? new Date() : null,
      },
    });

    return NextResponse.json({ data: patient, success: true }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A patient with this NSS already exists", success: false },
        { status: 409 }
      );
    }
    console.error("[POST /api/v1/patients]", error);
    return NextResponse.json(
      { error: "Failed to create patient", success: false },
      { status: 500 }
    );
  }
}
