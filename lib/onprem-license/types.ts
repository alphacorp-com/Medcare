// Mirrored independently in alphacorp/lib/licensing/types.ts — the two repos
// have no shared package (no network link between them either), so this
// shape is duplicated by hand. Keep both copies in sync when it changes.
export type LicenseTier = "core" | "clinical" | "advanced" | "enterprise";

export interface LicensePayload {
  jti: string;
  clientId: string;
  fingerprint: string | null;
  tier: LicenseTier;
  modules: string[];
  maxUsers: number | null;
  maxBeds: number | null;
  validFrom: string;
  validUntil: string;
  gracePeriodDays: number;
  issuedAt: string;
  iss: "alphacorp";
}
