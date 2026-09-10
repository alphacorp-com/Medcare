"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

export type VitalsForm = {
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  pulse: string;
  temperature: string;
  weight: string;
  height: string;
  spo2: string;
};

export const EMPTY_VITALS: VitalsForm = {
  bloodPressureSystolic: "",
  bloodPressureDiastolic: "",
  pulse: "",
  temperature: "",
  weight: "",
  height: "",
  spo2: "",
};

/** Shared 6-field vital signs grid, used both at admission intake and for follow-up readings during a stay. */
export function VitalsFields({
  value,
  onChange,
  labelKey = "vitals_title",
}: {
  value: VitalsForm;
  onChange: (next: VitalsForm) => void;
  labelKey?: string;
}) {
  const t = useTranslations("admissions");

  const update = <K extends keyof VitalsForm>(key: K, v: VitalsForm[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase">{t(labelKey)}</label>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex gap-1 col-span-2">
          <Input
            type="number"
            value={value.bloodPressureSystolic}
            onChange={(e) => update("bloodPressureSystolic", e.target.value)}
            placeholder={t("vitals_systolic")}
            className="h-8 text-xs bg-white border-slate-200"
          />
          <Input
            type="number"
            value={value.bloodPressureDiastolic}
            onChange={(e) => update("bloodPressureDiastolic", e.target.value)}
            placeholder={t("vitals_diastolic")}
            className="h-8 text-xs bg-white border-slate-200"
          />
        </div>
        <Input
          type="number"
          value={value.pulse}
          onChange={(e) => update("pulse", e.target.value)}
          placeholder={t("vitals_pulse")}
          className="h-8 text-xs bg-white border-slate-200"
        />
        <Input
          type="number"
          step="0.1"
          value={value.temperature}
          onChange={(e) => update("temperature", e.target.value)}
          placeholder={t("vitals_temperature")}
          className="h-8 text-xs bg-white border-slate-200"
        />
        <Input
          type="number"
          step="0.1"
          value={value.weight}
          onChange={(e) => update("weight", e.target.value)}
          placeholder={t("vitals_weight")}
          className="h-8 text-xs bg-white border-slate-200"
        />
        <Input
          type="number"
          step="0.1"
          value={value.height}
          onChange={(e) => update("height", e.target.value)}
          placeholder={t("vitals_height")}
          className="h-8 text-xs bg-white border-slate-200"
        />
        <Input
          type="number"
          value={value.spo2}
          onChange={(e) => update("spo2", e.target.value)}
          placeholder={t("vitals_spo2")}
          className="h-8 text-xs bg-white border-slate-200"
        />
      </div>
    </div>
  );
}
