"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export type MedicalActOption = {
  code: string;
  label: string;
  price: number | null;
  categoryName: string;
};

// The billable act chosen at admission (consultation, specialist visit…). Its price is
// charged right away and the patient pays it at the cashier before reaching the doctor.
export function useMedicalActs() {
  const [acts, setActs] = useState<MedicalActOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/medical-acts")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && Array.isArray(json)) setActs(json);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { acts, loaded };
}

export function MedicalActSelect({
  acts,
  value,
  onChange,
  optional,
}: {
  acts: MedicalActOption[];
  value: string;
  onChange: (code: string) => void;
  // Vital emergencies may be admitted before the act is known.
  optional?: boolean;
}) {
  const t = useTranslations("admissions");

  const byCategory = acts.reduce<Record<string, MedicalActOption[]>>((groups, act) => {
    (groups[act.categoryName] ??= []).push(act);
    return groups;
  }, {});

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase">
        {t("medical_act")} {!optional && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="">{acts.length === 0 ? t("medical_act_none_configured") : t("medical_act_placeholder")}</option>
        {Object.entries(byCategory).map(([category, items]) => (
          <optgroup key={category} label={category}>
            {items.map((act) => (
              <option key={act.code} value={act.code}>
                {act.label}
                {act.price != null ? ` — ${act.price.toLocaleString()} FCFA` : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="text-[10px] text-slate-500">{optional ? t("medical_act_hint_emergency") : t("medical_act_hint")}</p>
    </div>
  );
}

export const isVitalEmergencyTriage = (type: string, triageAcuity: string) =>
  type === "emergency" && (triageAcuity === "resuscitation" || triageAcuity === "emergent");
