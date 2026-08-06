"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  FileText,
  Pill,
  Activity,
  Image as ImageIcon,
  CreditCard,
  HeartPulse,
  Scissors,
  Baby
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import {
  StayRow,
  MedicalRecordRow,
  PrescriptionRow,
  ExamRow,
  BillingRow,
  VitalSignsRow,
  SurgeryRow,
  PregnancyRow,
  PrescriptionItem
} from "../types";

interface PatientTabsProps {
  stays: StayRow[];
  records: MedicalRecordRow[];
  prescriptions: PrescriptionRow[];
  exams: ExamRow[];
  billing: BillingRow[];
  vitals: VitalSignsRow[];
  surgeries: SurgeryRow[];
  pregnancies: PregnancyRow[];
  onAddRecord: () => void;
}

export function PatientTabs({
  stays,
  records,
  prescriptions,
  exams,
  billing,
  vitals,
  surgeries,
  pregnancies,
  onAddRecord,
}: PatientTabsProps) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const trx = useTranslations('pharmacy');
  const trad = useTranslations('radiology');

  const stayTypeLabel = (st: string) => {
    if (st === "emergency") return tc("status_emergency");
    if (st === "scheduled") return tc("status_scheduled");
    return st;
  };

  const stayStatusLabel = (s: string) => {
    if (s === "in_progress") return tc("status_in_progress");
    if (s === "discharged") return tc("status_discharged");
    return s;
  };

  const describePrescription = (items: unknown): string => {
    if (!Array.isArray(items) || items.length === 0) return "—";
    return (items as PrescriptionItem[])
      .map((it) => {
        const name = it.drug ?? it.name ?? "Item";
        const dose = it.dose ? ` ${it.dose}` : "";
        const freq = it.frequency ? ` - ${it.frequency}` : "";
        return `${name}${dose}${freq}`;
      })
      .join(", ");
  };

  return (
    <div className="col-span-9 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
      <Tabs defaultValue="admissions" className="w-full flex-1 flex flex-col">
        <div className="px-2 pt-2 border-b border-slate-200 bg-slate-50 shrink-0 overflow-x-auto overflow-y-hidden">
          <TabsList className="h-9 bg-transparent p-0 flex flex-nowrap justify-start gap-4 w-max min-w-full">
            <TabsTrigger
              value="admissions"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs shrink-0"
            >
              <Calendar className="h-3.5 w-3.5 mr-2" /> {t('admissions_stays')}
            </TabsTrigger>
            <TabsTrigger
              value="records"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs shrink-0"
            >
              <FileText className="h-3.5 w-3.5 mr-2" /> {t('medical_records')}
            </TabsTrigger>
            <TabsTrigger
              value="prescriptions"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs shrink-0"
            >
              <Pill className="h-3.5 w-3.5 mr-2" /> {trx('queue_tab')}
            </TabsTrigger>
            <TabsTrigger
              value="labs"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs shrink-0"
            >
              <Activity className="h-3.5 w-3.5 mr-2" /> {tc('laboratory')}
            </TabsTrigger>
            <TabsTrigger
              value="imaging"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs shrink-0"
            >
              <ImageIcon className="h-3.5 w-3.5 mr-2" /> {tc('radiology')}
            </TabsTrigger>
            <TabsTrigger
              value="vitals"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs shrink-0"
            >
              <HeartPulse className="h-3.5 w-3.5 mr-2" /> {t('vitals_tab')}
            </TabsTrigger>
            <TabsTrigger
              value="surgery"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs shrink-0"
            >
              <Scissors className="h-3.5 w-3.5 mr-2" /> {tc('surgery')}
            </TabsTrigger>
            <TabsTrigger
              value="maternity"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs shrink-0"
            >
              <Baby className="h-3.5 w-3.5 mr-2" /> {tc('maternity')}
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs shrink-0"
            >
              <CreditCard className="h-3.5 w-3.5 mr-2" /> {tc('billing')}
            </TabsTrigger>
          </TabsList>
        </div>
        
        <div className="flex-1 overflow-auto bg-white p-0">
          <TabsContent value="admissions" className="m-0 border-none outline-none">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{tc('stay_id')}</th>
                  <th className="px-4 py-2">{tc('admission_date')}</th>
                  <th className="px-4 py-2">{tc('type')}</th>
                  <th className="px-4 py-2">{tc('discharge_date')}</th>
                  <th className="px-4 py-2">PMSI</th>
                  <th className="px-4 py-2">{tc('dept_bed')}</th>
                  <th className="px-4 py-2">{tc('doctor')}</th>
                  <th className="px-4 py-2">{tc('status')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {stays.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500 italic">{t('no_admissions')}</td></tr>
                )}
                {stays.map((adm) => (
                  <tr key={adm.id} className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-slate-600">{adm.stayNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{format(new Date(adm.admissionDate), "MMM d, yyyy HH:mm")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                        adm.type === 'emergency' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")}>
                        {stayTypeLabel(adm.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {adm.dischargeDate ? format(new Date(adm.dischargeDate), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {adm.pmsiCode ? (
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-semibold font-mono",
                          adm.pmsiValidated ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        )}>
                          {adm.pmsiCode}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{adm.departmentId ?? "—"} <span className="text-slate-500 block text-[10px]">{adm.bedId ?? ""}</span></td>
                    <td className="px-4 py-3">{adm.attendingDoctorId ?? "—"}</td>
                    <td className="px-4 py-3">
                       <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                        adm.status === 'in_progress' ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700")}>
                         {stayStatusLabel(adm.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="records" className="m-0 border-none outline-none">
            <div className="flex justify-end p-2 border-b border-slate-100">
              <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={onAddRecord}>
                + {t('add_medical_record')}
              </Button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{tc('date')}</th>
                  <th className="px-4 py-2">{tc('type')}</th>
                  <th className="px-4 py-2">{tc('title')}</th>
                  <th className="px-4 py-2">{tc('stay')}</th>
                  <th className="px-4 py-2">{tc('status')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {records.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_medical_records')}</td></tr>
                )}
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-slate-900">{format(new Date(rec.createdAt), "MMM d, yyyy HH:mm")}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-slate-100 text-slate-700">
                        {rec.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">{rec.title || '—'}</td>
                    <td className="px-4 py-3">{rec.stay?.stayNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                        rec.isSigned ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                        {rec.isSigned ? tc('signed') : tc('unsigned')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="prescriptions" className="m-0 border-none outline-none">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{tc('date_prescribed')}</th>
                  <th className="px-4 py-2">{tc('medication')}</th>
                  <th className="px-4 py-2">{trx('prescriber')}</th>
                  <th className="px-4 py-2">{tc('status')}</th>
                  <th className="px-4 py-2 text-right">{tc('dispense_history')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {prescriptions.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_prescriptions')}</td></tr>
                )}
                {prescriptions.map((rx) => {
                  const lastDispense = rx.drugDispensings?.[0];
                  return (
                    <tr key={rx.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">
                        <div>{format(new Date(rx.prescribedAt), "MMM d, yyyy")}</div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">{rx.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{describePrescription(rx.items)}</td>
                      <td className="px-4 py-3 text-slate-600">{rx.prescriberId}</td>
                      <td className="px-4 py-3">
                         <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                          rx.status === 'validated' ? "bg-blue-100 text-blue-700" :
                          rx.status === 'dispensed' ? "bg-green-100 text-green-700" :
                          "bg-slate-100 text-slate-700")}>
                          {rx.status}
                         </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                         {lastDispense ? (
                           <div className="text-[10px] text-slate-500">
                             <span className="text-green-600 font-semibold mb-0.5 block">{tc('dispensed_on')} {format(new Date(lastDispense.dispensedAt), "MMM d, yyyy")}</span>
                           </div>
                         ) : (
                           <span className="text-slate-400 text-[10px] italic">{t('awaiting_dispense')}</span>
                         )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="labs" className="m-0 border-none outline-none">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{tc('test_id')}</th>
                  <th className="px-4 py-2">{tc('date')}</th>
                  <th className="px-4 py-2">{tc('panel_assay')}</th>
                  <th className="px-4 py-2">{tc('status')}</th>
                  <th className="px-4 py-2 text-right">{tc('result')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {exams.filter((e) => e.type === 'biology').length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_laboratory_tests')}</td></tr>
                )}
                {exams.filter((e) => e.type === 'biology').map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-600">{e.examCode}</td>
                    <td className="px-4 py-3 text-slate-600">{format(new Date(e.requestedAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-slate-900">{e.examLabel}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                        e.results.length > 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                        {e.results.length > 0 ? tc('status_final') : e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.results.length > 0 ? (
                        <button className="text-blue-600 hover:underline">{tc('view')}</button>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">{t('pending')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="imaging" className="m-0 border-none outline-none">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{tc('scan_id')}</th>
                  <th className="px-4 py-2">{tc('date')}</th>
                  <th className="px-4 py-2">{trad('modality') || "Modality"}</th> 
                  <th className="px-4 py-2">{trad('region') || "Region"}</th>
                  <th className="px-4 py-2 text-right">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {exams.filter((e) => e.type === 'radiology').length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_imaging_studies')}</td></tr>
                )}
                {exams.filter((e) => e.type === 'radiology').map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-600">{e.examCode}</td>
                    <td className="px-4 py-3 text-slate-600">{format(new Date(e.requestedAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 font-semibold">{e.examCode}</td>
                    <td className="px-4 py-3 text-slate-900">{e.examLabel}</td>
                    <td className="px-4 py-3 text-right"><button className="text-blue-600 hover:underline">{t('open_viewer')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="vitals" className="m-0 border-none outline-none">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{tc('date')}</th>
                  <th className="px-4 py-2">{t('vitals_bp')}</th>
                  <th className="px-4 py-2">{t('vitals_pulse')}</th>
                  <th className="px-4 py-2">{t('vitals_temperature')}</th>
                  <th className="px-4 py-2">{t('vitals_weight')}</th>
                  <th className="px-4 py-2">{t('vitals_height')}</th>
                  <th className="px-4 py-2">{t('vitals_spo2')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {vitals.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500 italic">{t('no_vitals_recorded')}</td></tr>
                )}
                {vitals.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{format(new Date(v.recordedAt), "MMM d, yyyy HH:mm")}</td>
                    <td className="px-4 py-3 font-medium">
                      {v.bloodPressureSystolic && v.bloodPressureDiastolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : "—"}
                    </td>
                    <td className="px-4 py-3">{v.pulse ?? "—"}</td>
                    <td className="px-4 py-3">{v.temperature ? `${v.temperature}°C` : "—"}</td>
                    <td className="px-4 py-3">{v.weight ? `${v.weight} kg` : "—"}</td>
                    <td className="px-4 py-3">{v.height ? `${v.height} cm` : "—"}</td>
                    <td className="px-4 py-3">{v.spo2 ? `${v.spo2}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="surgery" className="m-0 border-none outline-none">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{tc('date')}</th>
                  <th className="px-4 py-2">{tc('procedure')}</th>
                  <th className="px-4 py-2">{tc('status')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {surgeries.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500 italic">{t('no_surgeries')}</td></tr>
                )}
                {surgeries.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {s.scheduledAt ? format(new Date(s.scheduledAt), "MMM d, yyyy") : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      {s.procedureLabel} {s.procedureCode && <span className="font-mono text-[10px] text-slate-400 ml-1">{s.procedureCode}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                        s.status === 'completed' ? "bg-green-100 text-green-700" :
                        s.status === 'in_progress' ? "bg-orange-100 text-orange-700" :
                        s.status === 'cancelled' ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-700")}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="maternity" className="m-0 border-none outline-none">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{tc('date')}</th>
                  <th className="px-4 py-2">{tc('status')}</th>
                  <th className="px-4 py-2">{tc('gravida_para')}</th>
                  <th className="px-4 py-2">{tc('cpn_visits')}</th>
                  <th className="px-4 py-2">{tc('delivery')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {pregnancies.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_pregnancies')}</td></tr>
                )}
                {pregnancies.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{format(new Date(p.lastMenstrualPeriod), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                        p.status === 'delivered' ? "bg-green-100 text-green-700" :
                        p.status === 'ongoing' ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-700")}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">G{p.gravida}P{p.para}</td>
                    <td className="px-4 py-3">{p.antenatalVisits.length}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.delivery?.deliveryDate ? format(new Date(p.delivery.deliveryDate), "MMM d, yyyy") : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="billing" className="m-0 border-none outline-none">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">{tc('stay_id')}</th>
                  <th className="px-4 py-2">{tc('date_generated')}</th>
                  <th className="px-4 py-2">{tc('amount')}</th>
                  <th className="px-4 py-2">{tc('coverage')}</th>
                  <th className="px-4 py-2">{tc('status')}</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {billing.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">{t('no_billing_records')}</td></tr>
                )}
                {billing.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-600">{bill.stay?.stayNumber || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{format(new Date(bill.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 font-medium">{Number(bill.subtotal).toLocaleString()} {bill.currency}</td>
                    <td className="px-4 py-3 text-slate-600">{Number(bill.insuranceAmount).toLocaleString()} {bill.currency}</td>
                    <td className="px-4 py-3">
                      <Link href={`/billing/${bill.id}`} className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold hover:underline",
                        bill.status === 'paid' ? "bg-green-100 text-green-700" :
                        bill.status === 'partially_paid' ? "bg-yellow-100 text-yellow-700" :
                        bill.status === 'cancelled' ? "bg-slate-100 text-slate-500" :
                        "bg-blue-100 text-blue-700")}>
                        {bill.status}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
