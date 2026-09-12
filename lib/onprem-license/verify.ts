// NODE-RUNTIME ONLY. Verifies a compact license token issued by AlphaCorp:
//   ALC1.<base64url(JSON payload)>.<base64url(ed25519 signature)>
// Mirrors alphacorp/lib/licensing/sign.ts — see that file for the format
// rationale. Returns null on ANY failure (bad shape, bad signature, bad
// JSON, wrong issuer) rather than throwing, so callers can treat "invalid
// token" as one uniform case.
import crypto from "crypto";
import { getLicensePublicKeyPem } from "./public-key";
import type { LicensePayload } from "./types";

const LICENSE_TOKEN_PREFIX = "ALC1";

export function verifyLicenseToken(token: string): LicensePayload | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== LICENSE_TOKEN_PREFIX) return null;

  const [, payloadSegment, signatureSegment] = parts;

  let signature: Buffer;
  let publicKey: crypto.KeyObject;
  try {
    signature = Buffer.from(signatureSegment, "base64url");
    publicKey = crypto.createPublicKey(getLicensePublicKeyPem());
  } catch {
    return null;
  }

  const isValid = crypto.verify(null, Buffer.from(payloadSegment, "utf8"), publicKey, signature);
  if (!isValid) return null;

  try {
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const payload = JSON.parse(json) as LicensePayload;
    if (
      payload.iss !== "alphacorp" ||
      typeof payload.jti !== "string" ||
      typeof payload.clientId !== "string" ||
      typeof payload.validFrom !== "string" ||
      typeof payload.validUntil !== "string"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
