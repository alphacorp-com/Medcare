"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Date and cause of a neonatal death (RMA3 II.1.4-016 to 022).
export const NEONATAL_DEATH_CAUSES = ["prematurity", "asphyxia", "infection", "other"] as const;

export function NeonatalDeathFields({ diedAt, onDiedAt, cause, onCause }: { diedAt: string; onDiedAt: (v: string) => void; cause: string; onCause: (v: string) => void }) {
  const t = useTranslations("maternity");
  const tc = useTranslations("common");
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label>{t("death_date")}</Label>
        <Input type="datetime-local" value={diedAt} max={new Date().toISOString().slice(0, 16)} onChange={(e) => onDiedAt(e.target.value)} className="h-9 text-xs" />
      </div>
      <div className="space-y-1">
        <Label>{t("death_cause")}</Label>
        <select value={cause} onChange={(e) => onCause(e.target.value)} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400">
          <option value="">{tc("select_placeholder")}</option>
          {NEONATAL_DEATH_CAUSES.map((c) => (
            <option key={c} value={c}>{t(`neonatal_cause_${c}`)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
