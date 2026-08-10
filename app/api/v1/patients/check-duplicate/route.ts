import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

// ── GET /api/v1/patients/check-duplicate ────────────────────────────────────
// Query params: firstName, lastName, birthDate (YYYY-MM-DD), nss?
// Strict exact-match lookup (unlike the loose `contains` search behind the
// patient-search typeahead) used to warn before creating a likely-duplicate
// patient record. Matches on exact lastName+firstName+birthDate, OR exact nss.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(request.url);
  const firstName = searchParams.get("firstName")?.trim();
  const lastName = searchParams.get("lastName")?.trim();
  const birthDate = searchParams.get("birthDate")?.trim();
  const nss = searchParams.get("nss")?.trim();

  const nameMatch = firstName && lastName && birthDate
    ? {
        firstName: { equals: firstName, mode: "insensitive" as const },
        lastName: { equals: lastName, mode: "insensitive" as const },
        birthDate: new Date(birthDate),
      }
    : null;

  if (!nameMatch && !nss) {
    return NextResponse.json({ matches: [], success: true });
  }

  const matches = await prisma.patient.findMany({
    where: {
      tenantId: session.user.tenantId,
      OR: [
        ...(nameMatch ? [nameMatch] : []),
        ...(nss ? [{ nss }] : []),
      ],
    },
    select: {
      id: true,
      ipp: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      nss: true,
    },
    take: 5,
  });

  return NextResponse.json({ matches, success: true });
}
