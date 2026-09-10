"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type TriageAcuity = "resuscitation" | "emergent" | "urgent" | "less_urgent" | "non_urgent";

export const TRIAGE_ACUITIES: TriageAcuity[] = ["resuscitation", "emergent", "urgent", "less_urgent", "non_urgent"];

const STYLES: Record<TriageAcuity, string> = {
  resuscitation: "bg-red-100 text-red-700",
  emergent: "bg-orange-100 text-orange-700",
  urgent: "bg-yellow-100 text-yellow-700",
  less_urgent: "bg-blue-100 text-blue-700",
  non_urgent: "bg-slate-100 text-slate-600",
};

export function TriageBadge({ acuity, className }: { acuity: TriageAcuity; className?: string }) {
  const t = useTranslations("admissions");
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold", STYLES[acuity], className)}>
      {t(acuity)}
    </span>
  );
}
