import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { findDuplicateCandidates, withNextIpp } from "@/lib/patients/duplicate-lookup";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";

// ── GET /api/v1/patients ──────────────────────────────────────────────────────
// Query params:
//   q       – full-text search across lastName, firstName, ipp, nss
//   status  – "active" | "deceased" (default: active)
//   page    – pagination page (default: 1)
//   limit   – results per page (default: 50, max 200)
//   sort    – "recent" (default: most recently registered first) | "name" (alphabetical)
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
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const sort = searchParams.get("sort") === "name" ? "name" : "recent";

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
        // Newest registration first, so a patient just created at the front desk is at the
        // top of the list; id breaks ties so pages never overlap or skip rows.
        orderBy:
          sort === "name"
            ? [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "desc" }],
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
      confirmDuplicate,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !birthDate || !gender) {
      return NextResponse.json(
        { error: "firstName, lastName, birthDate, and gender are required", success: false },
        { status: 400 }
      );
    }

    const parsedBirthDate = new Date(birthDate);
    if (Number.isNaN(parsedBirthDate.getTime())) {
      return NextResponse.json({ error: "birthDate must be a valid date", success: false }, { status: 400 });
    }

    // Likely duplicates are checked here, not only by the screen: a direct call, a failed
    // check in the browser or a second tab cannot create one silently. Creating anyway is an
    // explicit choice (confirmDuplicate), recorded in the audit log.
    const duplicates = await findDuplicateCandidates(session.user.tenantId, {
      firstName: String(firstName),
      lastName: String(lastName),
      birthDate: parsedBirthDate,
      nss: nss || null,
      phone: phone || null,
    });
    if (duplicates.length > 0 && confirmDuplicate !== true) {
      return NextResponse.json({ error: "possible_duplicate", matches: duplicates, success: false }, { status: 409 });
    }

    // IPP "10" + 7 digits, unique per facility; a simultaneous creation is retried with the next.
    const patient = await withNextIpp(session.user.tenantId, (ipp) => prisma.patient.create({
      data: {
        tenantId: session.user.tenantId,
        ipp,
        firstName,
        lastName,
        birthDate: parsedBirthDate,
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
    }));

    if (duplicates.length > 0) {
      await recordAuditEvent({
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorType: "tenant_user",
        action: "patient.created_despite_duplicate",
        resourceType: "patient",
        resourceId: patient.id,
        payload: { possibleDuplicates: duplicates.map((d) => ({ id: d.id, ipp: d.ipp, reasons: d.reasons })) },
        ...extractRequestMeta(request.headers),
      });
    }

    return NextResponse.json({ data: patient, success: true }, { status: 201 });
  } catch (error) {
    // Only the NSS can still collide here (IPP collisions are retried by withNextIpp).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const nssTaken = JSON.stringify(error.meta?.target ?? "").includes("nss");
      return NextResponse.json(
        { error: nssTaken ? "A patient with this NSS already exists" : "This patient number is already used, retry", success: false },
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
