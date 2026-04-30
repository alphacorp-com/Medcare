"use client";

import { useTranslations } from "next-intl";
import { User, MapPin, Phone } from "lucide-react";
import { PatientDetail } from "../types";

interface PatientQuickProfileProps {
  patient: PatientDetail;
}

export function PatientQuickProfile({ patient }: PatientQuickProfileProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');

  const ec = patient.emergencyContact ?? {};
  const allergies = Array.isArray(patient.allergies) ? patient.allergies : [];
  const chronic = Array.isArray(patient.chronicConditions) ? patient.chronicConditions : [];

  const genderLabel = (g: string) => {
    if (g === "M") return t('gender_male');
    if (g === "F") return t('gender_female');
    return t('gender_other');
  };

  return (
    <div className="col-span-3 flex flex-col gap-4 overflow-y-auto">
      <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">{t('demographics')}</div>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><User className="h-3 w-3" /> {tc('gender')} & {t('blood_group')}</div>
            <div className="text-xs font-semibold text-slate-900">{genderLabel(patient.gender)}, {patient.bloodGroup ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {tc('address')}</div>
            <div className="text-xs font-semibold text-slate-900">{patient.address ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /> {t('contact_info')}</div>
            <div className="text-xs font-semibold text-slate-900">{patient.phone ?? "—"}</div>
            <div className="text-xs text-slate-600">{patient.email ?? ""}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">{t('emergency_contact')}</div>
        <div className="space-y-3">
          <div>
            {ec.name || ec.phone ? (
              <>
                <div className="text-xs font-semibold text-slate-900">{ec.name ?? "—"}{ec.relation ? ` (${ec.relation})` : ""}</div>
                <div className="text-xs text-blue-600 mt-0.5">{ec.phone ?? ""}</div>
              </>
            ) : (
              <div className="text-xs text-slate-500 italic">{tc('no_data')}</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded border border-slate-800 shadow-sm p-4">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t('clinical_alerts')}</div>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-slate-500 mb-1 uppercase">{t('allergies')}</div>
            <div className="flex flex-wrap gap-1">
              {allergies.length === 0 && <span className="text-[10px] text-slate-500 italic">None</span>}
              {allergies.map((a) => (
                <span key={a} className="px-2 py-0.5 bg-red-900/50 text-red-400 border border-red-800 rounded text-[10px] font-semibold">{a}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 mb-1 uppercase">{t('chronic_conditions')}</div>
            <div className="flex flex-wrap gap-1">
              {chronic.length === 0 && <span className="text-[10px] text-slate-500 italic">None</span>}
              {chronic.map((c) => (
                <span key={c} className="px-2 py-0.5 bg-blue-900/50 text-blue-400 border border-blue-800 rounded text-[10px] font-semibold">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
