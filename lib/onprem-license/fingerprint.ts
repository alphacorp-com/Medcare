// Identifies this install's machine for license binding — not a secret, and
// not by itself an authentication mechanism (the per-client shared secret,
// see ONPREM_LICENSE_CLIENT_SECRET, does that). Its job is just to tie one
// issued license to one physical/virtual machine so a leaked license file
// can't silently be reused on a different install.
import os from "os";
import crypto from "crypto";

export interface Fingerprint {
  /** Full sha256 hex digest — embedded in requests/tokens. */
  raw: string;
  /** Short human-readable form for the admin to read aloud/type during offline support, e.g. "A1B2-C3D4-E5F6". */
  short: string;
}

export function computeFingerprint(): Fingerprint {
  const nets = os.networkInterfaces();
  const mac =
    Object.values(nets)
      .flat()
      .find((net) => net && !net.internal && net.mac && net.mac !== "00:00:00:00:00:00")?.mac ?? "no-mac";

  const material = [os.hostname(), mac, os.platform(), os.arch()].join("|");
  const raw = crypto.createHash("sha256").update(material).digest("hex");
  const short = raw
    .slice(0, 12)
    .toUpperCase()
    .replace(/(.{4})(?=.)/g, "$1-");

  return { raw, short };
}
