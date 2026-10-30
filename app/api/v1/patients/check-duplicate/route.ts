import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { findDuplicateCandidates } from "@/lib/patients/duplicate-lookup";

// ── GET /api/v1/patients/check-duplicate ────────────────────────────────────
// Query params: firstName, lastName, birthDate (YYYY-MM-DD), nss?, phone?
// Likely duplicates of a patient about to be created (rules: lib/patients/duplicates). The
// creation route applies the same check itself; this one lets a screen warn earlier.
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
  const firstName = searchParams.get("firstName")?.trim() ?? "";
  const lastName = searchParams.get("lastName")?.trim() ?? "";
  const birthDate = new Date(searchParams.get("birthDate")?.trim() ?? "");
  if (!lastName || Number.isNaN(birthDate.getTime())) {
    return NextResponse.json({ matches: [], success: true });
  }

  const matches = await findDuplicateCandidates(session.user.tenantId, {
    firstName,
    lastName,
    birthDate,
    nss: searchParams.get("nss"),
    phone: searchParams.get("phone"),
  });
  return NextResponse.json({ matches, success: true });
}
