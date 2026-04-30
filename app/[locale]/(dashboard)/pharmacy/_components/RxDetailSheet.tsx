"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { 
  AlertTriangle, 
  Check, 
  X, 
  Printer, 
  PillBottle, 
  FileWarning 
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PrescriptionRow } from "../types";

interface RxDetailSheetProps {
  rx: PrescriptionRow | null;
  onClose: () => void;
  onValidate: (id: string) => Promise<void>;
  onDispense: (id: string) => Promise<void>;
}

export function RxDetailSheet({ rx, onClose, onValidate, onDispense }: RxDetailSheetProps) {
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');

  if (!rx) return null;

  return (
    <Sheet open={!!rx} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg flex items-center gap-2">
                {t('rx_id')} {rx.id}
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                  rx.status === 'Pending Queue' ? "bg-yellow-100 text-yellow-700" :
                  rx.status === 'Validated' ? "bg-blue-100 text-blue-700" :
                  "bg-green-100 text-green-700"
                )}>
                  {rx.status}
                </span>
              </SheetTitle>
              <SheetDescription className="text-xs mt-1">
                {rx.prescriber} - {format(new Date(rx.date), "PPP 'at' p")}
              </SheetDescription>
            </div>
            {rx.alert && (
              <div className="bg-red-50 text-red-700 px-3 py-1.5 rounded border border-red-200 flex items-center gap-2 text-xs font-bold shrink-0">
                <AlertTriangle className="h-4 w-4" /> {t('priority_alert')}
              </div>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                {rx.patientName.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{rx.patientName}</div>
                <div className="text-[10px] font-mono text-slate-500">{tc('ipp')}: {rx.ipp}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7">{tc('view')}</Button>
          </div>

          {rx.alert && (
            <div className="bg-red-50 p-3 rounded border border-red-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-red-800 uppercase tracking-widest">
                <FileWarning className="w-3.5 h-3.5" /> {t('high_risk_interaction')}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-[10px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1 mb-2 tracking-widest">{t('order_details')}</h4>
            <div className="space-y-2">
              {rx.itemsData?.length > 0 ? (
                rx.itemsData.map((item: any, i: number) => (
                  <div key={i} className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{item.drug}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{item.dosage} — {item.frequency}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">{t('qty')}</div>
                        <div className="text-sm font-mono font-semibold">{item.quantity || "—"}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                Array.from({ length: rx.items }).map((_, i) => (
                  <div key={i} className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Amoxicillin 500mg Capsule</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">{t('qty')}</div>
                        <div className="text-sm font-mono font-semibold">21</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="p-4 border-t border-slate-200 bg-slate-100 shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] justify-between items-center sm:justify-between flex-row">
          <Button variant="ghost" size="sm" className="text-xs text-slate-600 hover:text-slate-900">
            <Printer className="mr-2 h-4 w-4" /> {tc('print')}
          </Button>

          <div className="flex gap-2">
            {rx.status === 'Pending Queue' && (
              <>
                <Button variant="outline" className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                  <X className="mr-2 h-3.5 w-3.5" /> {tc('cancel')}
                </Button>
                <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={() => onValidate(rx.id)}>
                  <Check className="mr-2 h-3.5 w-3.5" /> {t('validate')}
                </Button>
              </>
            )}
            {rx.status === 'Validated' && (
              <Button className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white" onClick={() => onDispense(rx.id)}>
                <PillBottle className="mr-2 h-3.5 w-3.5" /> {t('dispense')}
              </Button>
            )}
            {rx.status === 'Dispensed' && (
              <span className="text-xs font-bold uppercase tracking-wider text-green-700 flex items-center px-4 py-1.5 bg-green-100 rounded">
                <Check className="mr-2 h-4 w-4" /> {t('fulfilled')}
              </span>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
