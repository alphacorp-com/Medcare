"use client";

import { useTranslations } from "next-intl";
import { MobileGate } from "./mobile-gate";

export function TenantMobileGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  return (
    <MobileGate title={t("desktop_only_title")} description={t("desktop_only_desc")}>
      {children}
    </MobileGate>
  );
}
