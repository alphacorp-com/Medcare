"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useRouter } from "@/i18n/routing";
import { PatientRow, ageFromBirthDate } from "../types";

interface PatientsTableProps {
  patients: PatientRow[];
  loading: boolean;
  error: string | null;
}

export function PatientsTable({ patients, loading, error }: PatientsTableProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const router = useRouter();

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
            <th className="px-4 py-2">{tc('ipp')}</th>
            <th className="px-4 py-2">{tc('name')}</th>
            <th className="px-4 py-2">{tc('gender')}</th>
            <th className="px-4 py-2">{tc('dob')}</th>
            <th className="px-4 py-2">{tc('status')}</th>
            <th className="px-4 py-2 text-right">{tc('actions')}</th>
          </tr>
        </thead>
        <tbody className="text-xs divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="animate-pulse">
                <td className="px-4 py-4"><div className="h-3 bg-slate-100 rounded w-24" /></td>
                <td className="px-4 py-4"><div className="h-3 bg-slate-100 rounded w-40" /></td>
                <td className="px-4 py-4"><div className="h-3 bg-slate-100 rounded w-6" /></td>
                <td className="px-4 py-4"><div className="h-3 bg-slate-100 rounded w-24" /></td>
                <td className="px-4 py-4"><div className="h-3 bg-slate-100 rounded w-16" /></td>
                <td className="px-4 py-4"><div className="h-3 bg-slate-100 rounded w-10 ml-auto" /></td>
              </tr>
            ))
          ) : error ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-red-600 text-xs">{error}</td>
            </tr>
          ) : patients.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                {t('no_patients_found')}
              </td>
            </tr>
          ) : (
            patients.map((patient) => (
              <tr
                key={patient.id}
                className="hover:bg-blue-50/50 cursor-pointer group transition-colors"
                onClick={() => router.push(`/patients/${patient.id}`)}
              >
                <td className="px-4 py-3 font-mono text-slate-600">{patient.ipp}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{patient.lastName} {patient.firstName}</td>
                <td className="px-4 py-3">{patient.gender}</td>
                <td className="px-4 py-3">
                  {format(new Date(patient.birthDate), "yyyy-MM-dd")}
                  <span className="text-slate-400 ml-1">({t('age_years', { age: ageFromBirthDate(patient.birthDate) })})</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                    patient.isDeceased ? "bg-slate-200 text-slate-700" : "bg-green-100 text-green-700"
                  )}>
                    {patient.isDeceased ? t('status_deceased') : tc('status_active')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/patients/${patient.id}`);
                    }}
                  >
                    {tc('view')}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
