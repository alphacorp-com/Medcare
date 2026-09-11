// First-run bootstrap for a freshly deployed on-prem MedCare install. Only
// ever usable ONCE — locks itself the moment a TenantUser exists (see the
// count check below, re-verified inside the transaction to close the race
// between two simultaneous submissions).
//
// Gated by ONPREM_LICENSE_CLIENT_SECRET (the same per-client secret already
// handed to this site's operator during on-prem license activation — see
// lib/onprem-license/*) rather than left wide open: for an online-reachable
// deployment, an unauthenticated /setup would let anyone on the public
// internet race to claim the first admin account before the real operator
// does. Requiring the secret ties this to "you're the person who was
// actually given this site's credential," with zero new secret-distribution
// mechanism to build.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TenantType, TenantStatus } from "@prisma/client";

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

// Unicode combining diacritical marks (U+0300-U+036F) — stripped after NFD
// normalization so accented names ("Hôpital") slugify to plain ASCII.
const DIACRITIC_MARKS = /[̀-ͯ]/g;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(DIACRITIC_MARKS, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "clinic"
  );
}

export async function POST(request: Request) {
  const expectedSecret = process.env.ONPREM_LICENSE_CLIENT_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "This install is not yet configured for setup (ONPREM_LICENSE_CLIENT_SECRET is not set)." },
      { status: 500 }
    );
  }

  const existingCount = await prisma.tenantUser.count();
  if (existingCount > 0) {
    return NextResponse.json({ error: "Setup has already been completed on this install." }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const orgName = String(body.orgName ?? "").trim();
  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");
  const clientSecret = String(body.clientSecret ?? "");

  if (!orgName || !fullName || !email) {
    return NextResponse.json({ error: "Organization name, full name, and email are required." }, { status: 400 });
  }
  if (password.length < 12) {
    return NextResponse.json({ error: "Password must be at least 12 characters." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }
  if (!secretsMatch(clientSecret, expectedSecret)) {
    return NextResponse.json({ error: "Invalid site secret." }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction to close the race between two
      // concurrent submissions both passing the outer count() check.
      const raceCheck = await tx.tenantUser.count();
      if (raceCheck > 0) {
        throw new Error("ALREADY_SET_UP");
      }

      let tenant = await tx.tenant.findFirst({ where: { dbSchema: "public" } });
      if (!tenant) {
        tenant = await tx.tenant.create({
          data: {
            slug: slugify(orgName),
            name: orgName,
            type: TenantType.hospital,
            status: TenantStatus.active,
            dbSchema: "public",
            contactEmail: email,
          },
        });
      }

      // Every install needs at least one isSystemAdmin role to administer it — the
      // first-run admin created here gets one, named generically since there's no
      // locale preference captured yet (renamable afterward from Settings > Roles).
      let adminRole = await tx.role.findFirst({ where: { tenantId: tenant.id, isSystemAdmin: true } });
      if (!adminRole) {
        adminRole = await tx.role.create({
          data: { tenantId: tenant.id, name: "Administrator", isSystemAdmin: true },
        });
      }

      const user = await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          email,
          fullName,
          roleId: adminRole.id,
          passwordHash,
          modules: [],
          isActive: true,
        },
      });

      return { tenant, user };
    });

    return NextResponse.json({ message: "Setup complete.", tenantId: result.tenant.id });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_SET_UP") {
      return NextResponse.json({ error: "Setup has already been completed on this install." }, { status: 409 });
    }
    console.error("Setup failed:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
