"use client";

import { useEffect, useState } from "react";
import type { PdfFacility, PdfSettings } from "./types";

const DEFAULT_FACILITY: PdfFacility = { name: "", address: "", phone: "", email: "" };

// Matches the default components/settings/document-templates.tsx assumes when the tenant
// has never saved a preference — GET /api/v1/settings/templates returns {} in that case.
const DEFAULT_SETTINGS: PdfSettings = {
  showLogo: false,
  includeQR: false,
  digitalSignature: false,
  watermark: true,
};

// Fetches the tenant's real organization info + saved document-template settings, so every
// print site renders the branding/watermark the admin actually configured instead of each
// screen hardcoding its own guess (see components/settings/document-templates.tsx:110-118
// for the same organization -> PdfFacility mapping, centralized here for reuse).
export function usePdfBranding() {
  const [facility, setFacility] = useState<PdfFacility>(DEFAULT_FACILITY);
  const [settings, setSettings] = useState<PdfSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [orgRes, tplRes] = await Promise.all([
          fetch("/api/v1/settings/organization"),
          fetch("/api/v1/settings/templates"),
        ]);
        const [org, tpl] = await Promise.all([orgRes.json(), tplRes.json()]);

        if (cancelled) return;

        if (orgRes.ok) {
          const metadata = (org.metadata && typeof org.metadata === "object" ? org.metadata : {}) as { taxId?: string };
          setFacility({
            name: org.name || "",
            address: org.address || "",
            phone: org.contactPhone || "",
            email: org.contactEmail || "",
            logoUrl: org.logoUrl || undefined,
            taxId: metadata.taxId || undefined,
          });
        }
        if (tplRes.ok) {
          setSettings({ ...DEFAULT_SETTINGS, ...tpl });
        }
      } catch (error) {
        console.error("Failed to load document branding:", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { facility, settings, loaded };
}
