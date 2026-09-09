import crypto from "crypto";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractRequestMeta } from "@/lib/audit";

// Second auth path for `/api/admin/*` routes, alongside the existing NextAuth session
// cookie: a shared service credential (MEDCARE_SERVICE_API_KEY) that lets AlphaCorp call
// these routes directly as a service, attributing each call to a named human on its side
// via the X-Actor-* headers rather than acting as an anonymous/system caller.

export interface AdminAuthContext {
  actorId: string;
  actorType: "admin" | "api";
  actorLabel: string;
  isSuperAdmin: boolean;
}

export type AdminAuthResult =
  | ({ ok: true } & AdminAuthContext)
  | { ok: false; status: 401 | 403; error: string };

// Same bilingual message requireSuperAdmin (lib/permissions.ts) returns for its 403, so a
// caller on either auth path sees a consistent error for "not a super admin".
const SUPER_ADMIN_REQUIRED_ERROR = bilingual(
  "This action requires MedCare super admin privileges.",
  "Cette action nécessite des privilèges de super administrateur MedCare."
);

function bilingual(en: string, fr: string): string {
  return `${en} / ${fr}`;
}

// Throttles only WRONG service-key attempts (never legitimate traffic, matched or not
// present at all) — generous enough that a misconfigured-but-real integration never trips
// it, while a script guessing at MEDCARE_SERVICE_API_KEY hits the wall almost immediately.
const SERVICE_KEY_MISMATCH_MAX_ATTEMPTS = 20;
const SERVICE_KEY_MISMATCH_WINDOW_MS = 10 * 60_000;

// Constant-time secret comparison — avoids leaking how many leading bytes of a guessed
// key matched via response-time differences. Buffers of unequal length are rejected
// before reaching timingSafeEqual, which throws on a length mismatch.
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

// Deterministic actor id derived from the service caller's attributed email, formatted to
// match the UUID shape already used for AuditLog.actorId elsewhere (see SYSTEM_ACTOR_ID in
// lib/audit.ts). Hashing (rather than using the email directly) keeps actorId's shape
// consistent with every other actorId in the audit log; it's stable per email, so the same
// AlphaCorp user threads together across calls without us needing to persist a mapping.
function deriveServiceActorId(email: string): string {
  const hex = crypto
    .createHash("sha256")
    .update(`alphacorp-service:${email.toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Gate for every `/api/admin/*` route that today only checks the human session cookie.
// Adds a service-credential path (Bearer MEDCARE_SERVICE_API_KEY + X-Actor-* headers) that
// AlphaCorp calls with directly, while leaving the session-cookie path byte-identical to
// what every route already enforced.
export async function requireAdminOrServiceAuth(request: NextRequest): Promise<AdminAuthResult> {
  const authHeader = request.headers.get("authorization");
  const serviceApiKey = process.env.MEDCARE_SERVICE_API_KEY;

  if (authHeader?.startsWith("Bearer ")) {
    const providedKey = authHeader.slice("Bearer ".length).trim();

    if (serviceApiKey && secretsMatch(providedKey, serviceApiKey)) {
      const email = request.headers.get("x-actor-email");
      if (!email) {
        return {
          ok: false,
          status: 401,
          error: "X-Actor-Email header is required for service authentication.",
        };
      }

      const name = request.headers.get("x-actor-name") || email;
      const role = request.headers.get("x-actor-role");
      const isSuperAdmin = role === "SUPERADMIN";

      return {
        ok: true,
        actorId: deriveServiceActorId(email),
        actorType: "api",
        actorLabel: `AlphaCorp: ${name} <${email}>`,
        isSuperAdmin,
      };
    }

    // Wrong Bearer value — this is either a brute-force attempt against the service key or
    // a misconfigured caller, never a legitimate human (those don't send Authorization at
    // all). Track it per-IP and reject once the window's attempt budget is spent, rather
    // than falling through to the session check below on every single guess.
    const { ipAddress } = extractRequestMeta(request.headers);
    const rateLimit = checkRateLimit(
      `admin-service-auth:mismatch:${ipAddress ?? "unknown"}`,
      SERVICE_KEY_MISMATCH_MAX_ATTEMPTS,
      SERVICE_KEY_MISMATCH_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return { ok: false, status: 401, error: "Too many authentication attempts. Please try again later." };
    }
  }

  // No matching Bearer credential — fall back to the existing human session-cookie path.
  // Must stay byte-identical to what every route already did for this path.
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return {
    ok: true,
    actorId: session.user.id,
    actorType: "admin",
    actorLabel: session.user.name ?? session.user.email ?? session.user.id,
    isSuperAdmin: session.user.adminRole === "superadmin",
  };
}

// Same as requireAdminOrServiceAuth, but additionally requires super-admin privileges —
// for the two licensing routes that currently call requireSuperAdmin(session).
export async function requireSuperAdminOrServiceAuth(request: NextRequest): Promise<AdminAuthResult> {
  const auth = await requireAdminOrServiceAuth(request);
  if (!auth.ok) return auth;
  if (!auth.isSuperAdmin) {
    return { ok: false, status: 403, error: SUPER_ADMIN_REQUIRED_ERROR };
  }
  return auth;
}
