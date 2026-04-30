"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  History, 
  Stethoscope, 
  Pill, 
  Plus, 
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StayDetail } from "../types";

interface StayTabsProps {
  stay: StayDetail;
  onPrescriptionOpen: () => void;
  onOrderOpen: () => void;
  getDoctorName: (id: string) => string;
}

export function StayTabs({ stay, onPrescriptionOpen, onOrderOpen, getDoctorName }: StayTabsProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');

  return (
    <div className="col-span-9 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <Tabs defaultValue="timeline" className="w-full flex-1 flex flex-col">
        <div className="px-4 pt-4 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
          <TabsList className="h-10 bg-slate-100/50 p-1 rounded-lg gap-1 border border-slate-200/50">
            <TabsTrigger 
              value="timeline" 
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/50 rounded-md h-full text-xs transition-all px-4 font-medium"
            >
              <History className="h-3.5 w-3.5 mr-2 opacity-70" /> {t('stay_timeline')}
            </TabsTrigger>
            <TabsTrigger 
              value="medications" 
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/50 rounded-md h-full text-xs transition-all px-4 font-medium"
            >
              <Pill className="h-3.5 w-3.5 mr-2 opacity-70" /> {t('meds_administered')}
            </TabsTrigger>
            <TabsTrigger 
              value="orders" 
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/50 rounded-md h-full text-xs transition-all px-4 font-medium"
            >
              <Stethoscope className="h-3.5 w-3.5 mr-2 opacity-70" /> {t('doctor_orders')}
            </TabsTrigger>
          </TabsList>

          <div className="pb-4">
            <TabsContent value="medications" className="m-0 border-none outline-none">
              <Button size="sm" variant="default" className="h-8 text-[11px] px-4 rounded-lg bg-slate-900 hover:bg-slate-800 shadow-sm" onClick={onPrescriptionOpen}>
                <Plus className="h-3.5 w-3.5 mr-2" /> {t('new_prescription')}
              </Button>
            </TabsContent>
            <TabsContent value="orders" className="m-0 border-none outline-none">
              <Button size="sm" variant="default" className="h-8 text-[11px] px-4 rounded-lg bg-slate-900 hover:bg-slate-800 shadow-sm" onClick={onOrderOpen}>
                <Plus className="h-3.5 w-3.5 mr-2" /> {t('new_order')}
              </Button>
            </TabsContent>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto bg-white">
          <TabsContent value="timeline" className="m-0 border-none outline-none h-full">
            <ScrollArea className="h-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100">
                    <th className="px-6 py-4 w-40 tracking-wider">{tc('time')}</th>
                    <th className="px-6 py-4 w-48 tracking-wider">{t('event')}</th>
                    <th className="px-6 py-4 tracking-wider">{t('description_label')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-50">
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{format(new Date(stay.admissionDate), "MMM d, yyyy HH:mm")}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-800">Admission</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{stay.admissionReason || "Patient admitted"}</td>
                  </tr>
                  {stay.dischargeDate && (
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{format(new Date(stay.dischargeDate), "MMM d, yyyy HH:mm")}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-red-600">Discharge</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">Patient discharged</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="medications" className="m-0 border-none outline-none h-full">
            <ScrollArea className="h-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100">
                    <th className="px-6 py-4 w-40 tracking-wider">{tc('time')}</th>
                    <th className="px-6 py-4 tracking-wider">{t('medication_dose')}</th>
                    <th className="px-6 py-4 w-48 tracking-wider">{t('given_by')}</th>
                    <th className="px-6 py-4 w-32 tracking-wider">{tc('status')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-50">
                  {stay.prescriptions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/30">
                        <div className="flex flex-col items-center gap-2">
                          <Pill className="h-8 w-8 text-slate-200" />
                          <span className="text-[11px] uppercase tracking-widest font-semibold">{t('no_prescriptions')}</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stay.prescriptions.map((rx: any) => (
                      <tr key={rx.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5 font-mono text-[10px] text-slate-400 group-hover:text-slate-600">{format(new Date(rx.prescribedAt), "MMM d, yyyy HH:mm")}</td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-2">
                            {rx.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                <span className="font-bold text-slate-900">{item.drug}</span>
                                <span className="text-slate-400">—</span>
                                <span className="text-slate-600 font-medium">{item.dosage}</span>
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold">{item.frequency}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-slate-700 font-bold">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-slate-300" />
                            <span className="truncate max-w-[140px]">{getDoctorName(rx.prescriberId)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                           <span className={cn(
                             "px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-tight", 
                             rx.status === 'dispensed' ? "bg-green-100 text-green-700 shadow-sm" : "bg-orange-50 text-orange-600"
                           )}>
                            {rx.status || "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="orders" className="m-0 border-none outline-none h-full">
            <ScrollArea className="h-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100">
                    <th className="px-6 py-4 w-40 tracking-wider">{tc('time')}</th>
                    <th className="px-6 py-4 w-40 tracking-wider">{t('order_type')}</th>
                    <th className="px-6 py-4 tracking-wider">{t('exam_label')}</th>
                    <th className="px-6 py-4 w-32 tracking-wider">{t('urgency')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-50">
                  {stay.examRequests?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/30">
                        <div className="flex flex-col items-center gap-2">
                          <Stethoscope className="h-8 w-8 text-slate-200" />
                          <span className="text-[11px] uppercase tracking-widest font-semibold">{t('no_orders')}</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stay.examRequests?.map((order: any) => (
                      <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5 font-mono text-[10px] text-slate-400 group-hover:text-slate-600">{format(new Date(order.requestedAt), "MMM d, yyyy HH:mm")}</td>
                        <td className="px-6 py-5">
                          <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-tight">
                            {order.type}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-bold text-slate-900">{order.examLabel}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{order.examCode}</div>
                        </td>
                        <td className="px-6 py-5">
                           <span className={cn(
                             "px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-tight shadow-sm", 
                             order.urgency === 'stat' ? "bg-red-600 text-white" : 
                             order.urgency === 'urgent' ? "bg-orange-100 text-orange-700" : 
                             "bg-blue-100 text-blue-700"
                           )}>
                            {order.urgency}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
