"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, FileText, Pill, Activity, MapPin, Phone, User, Calendar, ShieldAlert, Image as ImageIcon, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { format } from "date-fns";

type EmergencyContact = { name?: string; relation?: string; phone?: string };

type PatientDetail = {
  id: string;
  ipp: string;
  nss: string | null;
  firstName: string;
  lastName: string;
  gender: "M" | "F" | "U";
  birthDate: string;
  bloodGroup: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  emergencyContact: EmergencyContact | null;
  allergies: string[];
  chronicConditions: string[];
  isDeceased: boolean;
};

type StayRow = {
  id: string;
  stayNumber: string;
  type: string;
  status: string;
  admissionDate: string;
  departmentId: string | null;
  bedId: string | null;
  attendingDoctorId: string | null;
};

type PrescriptionItem = { drug?: string; name?: string; dose?: string; frequency?: string; [k: string]: unknown };

type PrescriptionRow = {
  id: string;
  status: string;
  prescribedAt: string;
  items: PrescriptionItem[] | unknown;
  prescriberId: string;
  drugDispensings?: { id: string; dispensedAt: string }[];
};

type ExamResult = { id: string; resultData: unknown; isCritical: boolean; createdAt: string };

type ExamRow = {
  id: string;
  type: string;
  examCode: string;
  examLabel: string;
  status: string;
  requestedAt: string;
  results: ExamResult[];
};

function ageFromBirthDate(iso: string): number {
  const b = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function genderLabel(g: "M" | "F" | "U"): string {
  if (g === "M") return "Male";
  if (g === "F") return "Female";
  return "Other";
}

function stayTypeLabel(t: string, tc: ReturnType<typeof useTranslations>): string {
  if (t === "emergency") return tc("status_emergency");
  if (t === "scheduled") return tc("status_scheduled");
  return t;
}

function stayStatusLabel(s: string, tc: ReturnType<typeof useTranslations>): string {
  if (s === "in_progress") return tc("status_in_progress");
  if (s === "discharged") return tc("status_discharged");
  return s;
}

function describePrescription(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return (items as PrescriptionItem[])
    .map((it) => {
      const name = it.drug ?? it.name ?? "Item";
      const dose = it.dose ? ` ${it.dose}` : "";
      const freq = it.frequency ? ` - ${it.frequency}` : "";
      return `${name}${dose}${freq}`;
    })
    .join(", ");
}

export default function PatientDetailPage() {
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const trx = useTranslations('pharmacy');
  const trad = useTranslations('radiology');
  const params = useParams();
  const id = params.id as string;

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [stays, setStays] = useState<StayRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pRes, sRes, rxRes, exRes] = await Promise.all([
          fetch(`/api/v1/patients/${id}`),
          fetch(`/api/v1/patients/${id}/stays`),
          fetch(`/api/v1/patients/${id}/prescriptions`),
          fetch(`/api/v1/patients/${id}/exams`),
        ]);
        const [pJson, sJson, rxJson, exJson] = await Promise.all([
          pRes.json(),
          sRes.json(),
          rxRes.json(),
          exRes.json(),
        ]);
        if (cancelled) return;
        if (!pRes.ok || !pJson.success) throw new Error(pJson.error ?? "Failed to load patient");
        setPatient(pJson.data as PatientDetail);
        if (sJson.success) setStays(sJson.data as StayRow[]);
        if (rxJson.success) setPrescriptions(rxJson.data as PrescriptionRow[]);
        if (exJson.success) setExams(exJson.data as ExamRow[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-500">Loading…</div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Patient not found</h2>
          <p className="mt-2 text-sm text-slate-500">{error ?? "The requested patient does not exist."}</p>
          <Link href="/patients" className="mt-4 inline-block text-blue-600 text-xs underline">Back to directory</Link>
        </div>
      </div>
    );
  }

  const allergies = Array.isArray(patient.allergies) ? patient.allergies : [];
  const chronic = Array.isArray(patient.chronicConditions) ? patient.chronicConditions : [];
  const ec = patient.emergencyContact ?? {};
  const age = ageFromBirthDate(patient.birthDate);
  const dobLabel = `${format(new Date(patient.birthDate), "yyyy-MM-dd")} (${age} y.o.)`;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/patients" className="p-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 text-slate-500 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{patient.firstName} {patient.lastName}</h1>
              <span className={cn(
                  "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                  patient.isDeceased ? "bg-slate-200 text-slate-700" : "bg-green-100 text-green-700"
              )}>
                {patient.isDeceased ? "Deceased" : tc('status_active')}
              </span>
              {allergies.length > 0 && (
                 <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded uppercase font-semibold flex items-center gap-1">
                   <ShieldAlert className="h-3 w-3" /> {t('allergies')}
                 </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span className="font-mono">IPP: {patient.ipp}</span>
              {patient.nss && <><span>&bull;</span><span>NSS: <span className="font-mono">{patient.nss}</span></span></>}
              <span>&bull;</span>
              <span>{dobLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="text-xs h-8 text-slate-600">
             <Edit className="mr-2 h-3 w-3" />
             {tc('edit')}
           </Button>
           <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
             {tc('new_admission')}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Left Column: Quick Profile */}
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
                  <div className="text-xs text-slate-500 italic">Not provided</div>
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

        {/* Right Column: Multi-tab content */}
        <div className="col-span-9 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
          <Tabs defaultValue="admissions" className="w-full flex-1 flex flex-col">
            <div className="px-2 pt-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <TabsList className="h-9 bg-transparent p-0 flex justify-start gap-4">
                <TabsTrigger 
                  value="admissions" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Calendar className="h-3.5 w-3.5 mr-2" /> {t('admissions_stays')}
                </TabsTrigger>
                <TabsTrigger 
                  value="records" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <FileText className="h-3.5 w-3.5 mr-2" /> {t('medical_records')}
                </TabsTrigger>
                <TabsTrigger 
                  value="prescriptions" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Pill className="h-3.5 w-3.5 mr-2" /> {trx('queue_tab')}
                </TabsTrigger>
                <TabsTrigger 
                  value="labs" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Activity className="h-3.5 w-3.5 mr-2" /> {tc('laboratory')}
                </TabsTrigger>
                <TabsTrigger 
                  value="imaging" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <ImageIcon className="h-3.5 w-3.5 mr-2" /> {tc('radiology')}
                </TabsTrigger>
                <TabsTrigger 
                  value="billing" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
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
                      <th className="px-4 py-2">{tc('dept_bed')}</th>
                      <th className="px-4 py-2">{tc('doctor')}</th>
                      <th className="px-4 py-2">{tc('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {stays.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500 italic">No admissions on file</td></tr>
                    )}
                    {stays.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-3 font-mono text-slate-600">{adm.stayNumber}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{format(new Date(adm.admissionDate), "MMM d, yyyy HH:mm")}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                            adm.type === 'emergency' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")}>
                            {stayTypeLabel(adm.type, tc)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{adm.departmentId ?? "—"} <span className="text-slate-500 block text-[10px]">{adm.bedId ?? ""}</span></td>
                        <td className="px-4 py-3">{adm.attendingDoctorId ?? "—"}</td>
                        <td className="px-4 py-3">
                           <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                            adm.status === 'in_progress' ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700")}>
                             {stayStatusLabel(adm.status, tc)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="records" className="m-0 border-none outline-none">
                <div className="p-8 text-center text-xs text-slate-500 italic">Medical records module coming soon</div>
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
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">No prescriptions on file</td></tr>
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
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">No laboratory tests on file</td></tr>
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
                            <span className="text-slate-400 text-[10px] italic">Pending</span>
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
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">No imaging studies on file</td></tr>
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

              <TabsContent value="billing" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">{tc('invoice_no')}</th>
                      <th className="px-4 py-2">{tc('date_generated')}</th>
                      <th className="px-4 py-2">{tc('amount')}</th>
                      <th className="px-4 py-2">{tc('coverage')}</th>
                      <th className="px-4 py-2">{tc('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600">INV-2024-088</td>
                      <td className="px-4 py-3 text-slate-600">Jan 06, 2024</td>
                      <td className="px-4 py-3 font-medium">$4,250.00</td>
                      <td className="px-4 py-3 text-slate-600">BlueCross PPO</td>
                      <td className="px-4 py-3"><span className="text-green-700 bg-green-100 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">{tc('status_paid')}</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600">INV-2025-001</td>
                      <td className="px-4 py-3 text-slate-600">Oct 12, 2025</td>
                      <td className="px-4 py-3 font-medium">$850.00</td>
                      <td className="px-4 py-3 text-slate-600">BlueCross PPO</td>
                      <td className="px-4 py-3"><span className="text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">{tc('status_pending_claim')}</span></td>
                    </tr>
                  </tbody>
                </table>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
