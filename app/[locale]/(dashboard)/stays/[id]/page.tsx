"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Clock, BedDouble, ArrowRightLeft, History, Activity, Stethoscope, Pill, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { format } from "date-fns";

type StayDetail = {
  id: string;
  stayNumber: string;
  type: string;
  status: string;
  admissionDate: string;
  dischargeDate: string | null;
  admissionReason: string | null;
  dischargeSummary: string | null;
  departmentId: string | null;
  bedId: string | null;
  attendingDoctorId: string | null;
  pmsiCode: string | null;
  pmsiValidated: boolean;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    ipp: string;
    birthDate: string;
  };
  medicalRecords: any[];
  prescriptions: any[];
};

export default function AdmissionDetailPage() {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
  const tp = useTranslations('patients');
  const params = useParams();
  const id = params.id as string;
  const [stay, setStay] = useState<StayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStay = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/stays/${id}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to fetch stay");
        setStay(json.data as StayDetail);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch stay");
      } finally {
        setLoading(false);
      }
    };
    fetchStay();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !stay) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 text-sm">{error || "Stay not found"}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/stays" className="p-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 text-slate-500 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{stay.stayNumber}</h1>
              <span className={cn(
                  "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                  stay.status === 'in_progress' ? "bg-orange-100 text-orange-700" :
                  stay.status === 'discharged' ? "bg-green-100 text-green-700" :
                  "bg-slate-100 text-slate-600"
              )}>
                {stay.status.replace('_', ' ')}
              </span>
              <span className={cn(
                  "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                  stay.type === 'emergency' ? "bg-red-100 text-red-700" :
                  stay.type === 'scheduled' ? "bg-blue-100 text-blue-700" :
                  "bg-slate-100 text-slate-700"
              )}>
                {stay.type}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span className="font-semibold text-slate-700">{tc('patient')}: {stay.patient.firstName} {stay.patient.lastName}</span>
              <span>&bull;</span>
              <span>{tc('date')}: {format(new Date(stay.admissionDate), "MMM d, yyyy HH:mm")}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="text-xs h-8 text-slate-600">
             <ArrowRightLeft className="mr-2 h-3 w-3" />
             Transfer Bed
           </Button>
           <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs">
             Discharge Patient
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Left Column: Triage & Bed Info */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">{t('admission_details')}</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {t('location')}</div>
                <div className="text-xs font-semibold text-slate-900 border border-slate-200 bg-slate-50 rounded px-2 py-1 mt-1 inline-block">
                  {stay.departmentId || t('unassigned')} {stay.bedId && <><span className="text-slate-400">/</span> {stay.bedId}</>}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">{t('chief_complaint')}</div>
                <div className="text-xs font-semibold text-slate-900">{stay.admissionReason || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1">{t('attending_doctor_label')}</div>
                <div className="text-xs font-semibold text-slate-900">{stay.attendingDoctorId || t('unassigned')}</div>
              </div>
            </div>
          </div>

          {stay.dischargeSummary && (
            <div className="bg-blue-50 rounded border border-blue-100 shadow-sm p-4">
              <div className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-2 border-b border-blue-200/50 pb-2">{t('discharge_summary')}</div>
              <p className="text-xs text-blue-900 font-medium leading-relaxed">{stay.dischargeSummary}</p>
            </div>
          )}

          {stay.pmsiCode && (
            <div className="bg-slate-100 rounded border border-slate-200 shadow-sm p-4">
              <div className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-2 border-b border-slate-300/50 pb-2">{t('pmsi_code')}</div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-semibold font-mono",
                  stay.pmsiValidated ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                )}>
                  {stay.pmsiCode}
                </span>
                {stay.pmsiValidated && (
                  <span className="text-[10px] text-green-600 font-semibold">{t('validated')}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Multi-tab content */}
        <div className="col-span-9 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
          <Tabs defaultValue="timeline" className="w-full flex-1 flex flex-col">
            <div className="px-2 pt-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <TabsList className="h-9 bg-transparent p-0 flex justify-start gap-4">
                <TabsTrigger 
                  value="timeline" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <History className="h-3.5 w-3.5 mr-2" /> {t('stay_timeline')}
                </TabsTrigger>
                <TabsTrigger 
                  value="medications" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Pill className="h-3.5 w-3.5 mr-2" /> {t('meds_administered')}
                </TabsTrigger>
                <TabsTrigger 
                  value="orders" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Stethoscope className="h-3.5 w-3.5 mr-2" /> {t('doctor_orders')}
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-auto bg-white p-0">
              <TabsContent value="timeline" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2 w-32">{tc('time')}</th>
                      <th className="px-4 py-2 w-48">{t('event')}</th>
                      <th className="px-4 py-2">{t('description')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{format(new Date(stay.admissionDate), "MMM d, yyyy HH:mm")}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">Admission</td>
                      <td className="px-4 py-3 text-slate-600">Patient admitted</td>
                    </tr>
                    {stay.dischargeDate && (
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{format(new Date(stay.dischargeDate), "MMM d, yyyy HH:mm")}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">Discharge</td>
                        <td className="px-4 py-3 text-slate-600">Patient discharged</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="medications" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2 w-32">{tc('time')}</th>
                      <th className="px-4 py-2">Medication / Dose</th>
                      <th className="px-4 py-2 w-40">Given By</th>
                      <th className="px-4 py-2 w-32">{tc('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {stay.prescriptions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500 italic">
                          {t('no_prescriptions')}
                        </td>
                      </tr>
                    ) : (
                      stay.prescriptions.map((rx: any) => (
                        <tr key={rx.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{format(new Date(rx.prescribedAt), "MMM d, yyyy HH:mm")}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{rx.drug || rx.name || "Unknown"}</td>
                          <td className="px-4 py-3 text-slate-600">{rx.prescriberId || "—"}</td>
                          <td className="px-4 py-3">
                             <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold", 
                              rx.status === 'dispensed' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                              {rx.status || "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="orders" className="m-0 border-none outline-none p-6 text-center text-slate-500 text-xs">
                {tc('no_data')}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
