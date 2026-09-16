// Identifies this install's machine for license binding — not a secret, and
// not by itself an authentication mechanism (the per-client shared secret,
// see ONPREM_LICENSE_CLIENT_SECRET, does that). Its job is just to tie one
// issued license to one physical/virtual machine so a leaked license file
// can't silently be reused on a different install.
//
// The fingerprint MUST be stable across restarts: the license request and
// the later import of AlphaCorp's response are compared against each other,
// and renewals are issued against the fingerprint bound at first activation.
// Sources, most stable first:
//   1. ONPREM_INSTALL_ID — explicit, for containers/VMs whose hostname and
//      MAC change on every recreate (set it once per site and keep it).
//   2. The OS machine id (Windows MachineGuid, Linux /etc/machine-id, macOS
//      IOPlatformUUID) — survives reboots, network changes, VPNs, hotspots.
//   3. Hostname + the lowest physical MAC address — virtual adapters
//      (VMware, VirtualBox, Hyper-V, Docker, hotspot/Wi-Fi Direct) are
//      ignored, and the choice no longer depends on interface order.
import os from "os";
import fs from "fs";
import crypto from "crypto";
import { execFileSync } from "child_process";

export interface Fingerprint {
  /** Full sha256 hex digest — embedded in requests/tokens. */
  raw: string;
  /** Short human-readable form for the admin to read aloud/type during offline support, e.g. "A1B2-C3D4-E5F6". */
  short: string;
}

// OUI prefixes of common hypervisor virtual NICs.
const VIRTUAL_MAC_PREFIXES = ["00:50:56", "00:0c:29", "00:1c:14", "00:05:69", "08:00:27", "0a:00:27", "00:15:5d", "00:03:ff", "00:16:3e", "00:1c:42"];

function readMachineId(): string | null {
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        "reg",
        ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid", "/reg:64"],
        { encoding: "utf8", windowsHide: true, timeout: 5000 }
      );
      return out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i)?.[1] ?? null;
    }
    if (process.platform === "darwin") {
      const out = execFileSync("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], { encoding: "utf8", timeout: 5000 });
      return out.match(/"IOPlatformUUID" = "([^"]+)"/)?.[1] ?? null;
    }
    for (const path of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
      if (fs.existsSync(path)) {
        const id = fs.readFileSync(path, "utf8").trim();
        if (id) return id;
      }
    }
  } catch {
    // Fall through to the network-based fallback.
  }
  return null;
}

function isPhysicalMac(mac: string): boolean {
  const normalized = mac.toLowerCase();
  if (normalized === "00:00:00:00:00:00") return false;
  // Locally administered addresses (second-lowest bit of the first octet)
  // are assigned by software — Docker bridges, hotspots, randomized MACs.
  if (parseInt(normalized.slice(0, 2), 16) & 0b10) return false;
  return !VIRTUAL_MAC_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function networkMaterial(): string {
  const macs = [
    ...new Set(
      Object.values(os.networkInterfaces())
        .flat()
        .filter((net) => net && !net.internal && net.mac && isPhysicalMac(net.mac))
        .map((net) => net!.mac.toLowerCase())
    ),
  ].sort();
  return `host:${os.hostname()}|${macs[0] ?? "no-mac"}`;
}

// On serverless/container platforms every request may run on a different
// instance (different hostname, MACs, and often machine id), so without an
// explicit ONPREM_INSTALL_ID the license request and the later import never
// match. Returns a human-readable reason when that's the case.
export function fingerprintInstabilityReason(): string | null {
  if (process.env.ONPREM_INSTALL_ID?.trim()) return null;
  const platform =
    (process.env.VERCEL && "Vercel") ||
    (process.env.AWS_LAMBDA_FUNCTION_NAME && "AWS Lambda") ||
    (process.env.K_SERVICE && "Cloud Run / Firebase App Hosting") ||
    (process.env.NETLIFY && "Netlify") ||
    null;
  if (!platform) return null;
  return (
    `This install runs on ${platform}, where the machine changes between requests, so its license fingerprint is not stable. ` +
    "Set the ONPREM_INSTALL_ID environment variable (any random value, generated once and never changed) and redeploy before requesting or importing a license."
  );
}

let cached: Fingerprint | null = null;

export function computeFingerprint(): Fingerprint {
  if (cached) return cached;

  const installId = process.env.ONPREM_INSTALL_ID?.trim();
  const machineId = installId ? null : readMachineId();
  const source = installId ? `install:${installId}` : machineId ? `machine:${machineId}` : networkMaterial();

  const material = [source, os.platform(), os.arch()].join("|");
  const raw = crypto.createHash("sha256").update(material).digest("hex");
  const short = raw
    .slice(0, 12)
    .toUpperCase()
    .replace(/(.{4})(?=.)/g, "$1-");

  cached = { raw, short };
  return cached;
}
