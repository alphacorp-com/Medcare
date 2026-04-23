"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Clock, BedDouble, ArrowRightLeft, History, Activity, Stethoscope, Pill, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { useParams } from "next/navigation";

// Extended stub data simulating a fetched admission/stay
const stayData = {
  id: "STAY-001",
  stayNumber: "ADM-2025-001",
  patientName: "John Doe",
  patientId: "PAT-001",
  type: "Emergency",
  priority: "2-EMR",
  status: "In Progress",
  admissionDate: "Oct 12, 2025 10:30 AM",
  arrivalMode: "Ambulance",
  complaint: "Patient reports severe chest pain radiating to left arm. Sweating profusely.",
  department: "ICU",
  bed: "ICU-04",
  attendingPhysician: "Dr. S. Chen",
  primaryNurse: "Nurse G. Lee",
  vitals: {
    hr: "110 bpm",
    bp: "155/95 mmHg",
    spo2: "94%",
    temp: "37.2 °C"
  },
  timeline: [
    { id: "T-01", time: "Oct 12, 10:30 AM", event: "Admission", desc: "Registered at ER Triage by Auto-Kiosk" },
    { id: "T-02", time: "Oct 12, 10:35 AM", event: "Triage Assessment", desc: "Priority 2 assigned by Nurse G. Lee. Vitals taken." },
    { id: "T-03", time: "Oct 12, 10:45 AM", event: "Physician Consult", desc: "Dr. S. Chen evaluated patient. ECG ordered." },
    { id: "T-04", time: "Oct 12, 11:15 AM", event: "Bed Transfer", desc: "Moved from ER Bay 3 to ICU-04" },
  ],
  medications: [
    { id: "M-01", time: "Oct 12, 10:50 AM", name: "Aspirin 324mg (Chewed)", adminBy: "Nurse G. Lee", status: "Administered" },
    { id: "M-02", time: "Oct 12, 11:00 AM", name: "Nitroglycerin 0.4mg SL", adminBy: "Nurse G. Lee", status: "Administered" },
    { id: "M-03", time: "Oct 12, 02:00 PM", name: "Heparin IV Drip (800 units/hr)", adminBy: "--", status: "Due" },
  ]
};

export default function AdmissionDetailPage() {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
  const tp = useTranslations('patients');
  const params = useParams();
  const id = params.id as string;
  // Stub fetch
  const stay = stayData;

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
                  stay.status === 'In Progress' ? "bg-orange-100 text-orange-700" :
                  "bg-slate-100 text-slate-600"
              )}>
                {stay.status}
              </span>
              <span className={cn(
                  "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                  stay.type === 'Emergency' ? "bg-red-100 text-red-700" :
                  stay.type === 'Scheduled' ? "bg-blue-100 text-blue-700" :
                  "bg-slate-100 text-slate-700"
              )}>
                {stay.type}
              </span>
              {stay.priority && (
                 <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] rounded uppercase font-bold">
                   {stay.priority}
                 </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span className="font-semibold text-slate-700">{tc('patient')}: {stay.patientName}</span>
              <span>&bull;</span>
              <span>{tc('date')}: {stay.admissionDate}</span>
              <span>&bull;</span>
              <span>Dr. {stay.attendingPhysician}</span>
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
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Admission Details</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</div>
                <div className="text-xs font-semibold text-slate-900 border border-slate-200 bg-slate-50 rounded px-2 py-1 mt-1 inline-block">
                  {stay.department} <span className="text-slate-400">/</span> {stay.bed}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">{t('arrival_mode')}</div>
                <div className="text-xs font-semibold text-slate-900">{stay.arrivalMode}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1">Primary Care Team</div>
                <div className="text-xs font-semibold text-slate-900">{stay.attendingPhysician}</div>
                <div className="text-xs text-slate-600">Primary RN: {stay.primaryNurse}</div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded border border-red-100 shadow-sm p-4">
            <div className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-2 border-b border-red-200/50 pb-2">{t('chief_complaint')}</div>
            <p className="text-xs text-red-900 font-medium leading-relaxed">&quot;{stay.complaint}&quot;</p>
          </div>

          <div className="bg-slate-900 text-white rounded border border-slate-800 shadow-sm p-4">
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span>Latest Vitals</span>
              <span className="text-[9px] text-slate-500 font-normal">25m ago</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-slate-500">Heart Rate</div>
                <div className="text-sm font-bold text-red-400">{stay.vitals.hr}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Blood Pressure</div>
                <div className="text-sm font-bold text-yellow-400">{stay.vitals.bp}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">SpO2</div>
                <div className="text-sm font-bold">{stay.vitals.spo2}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Temp</div>
                <div className="text-sm font-bold">{stay.vitals.temp}</div>
              </div>
            </div>
          </div>
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
                  <History className="h-3.5 w-3.5 mr-2" /> Stay Timeline
                </TabsTrigger>
                <TabsTrigger 
                  value="medications" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Pill className="h-3.5 w-3.5 mr-2" /> Meds Administered
                </TabsTrigger>
                <TabsTrigger 
                  value="orders" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Stethoscope className="h-3.5 w-3.5 mr-2" /> Doctor Orders
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-auto bg-white p-0">
              <TabsContent value="timeline" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2 w-32">{tc('time')}</th>
                      <th className="px-4 py-2 w-48">Event</th>
                      <th className="px-4 py-2">{tc('description')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {stay.timeline.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{item.time}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{item.event}</td>
                        <td className="px-4 py-3 text-slate-600">{item.desc}</td>
                      </tr>
                    ))}
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
                    {stay.medications.map((med) => (
                      <tr key={med.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{med.time}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{med.name}</td>
                        <td className="px-4 py-3 text-slate-600">{med.adminBy}</td>
                        <td className="px-4 py-3">
                           <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold", 
                            med.status === 'Administered' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                            {med.status}
                          </span>
                        </td>
                      </tr>
                    ))}
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
