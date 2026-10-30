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
  Check,
  X,
  Receipt,
  PillBottle,
  Printer,
  FileText,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { PrescriptionRow } from "../types";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";
import type { MedicationGuideData } from "@/components/templates/MedicationGuideTemplate";
import { usePdfBranding } from "@/components/templates/usePdfBranding";

interface RxDetailSheetProps {
  rx: PrescriptionRow | null;
  onClose: () => void;
  onValidate: (id: string) => Promise<void>;
  onDispense: (id: string) => Promise<void>;
  // Resolves to an error message, or null once cancelled.
  onCancel: (id: string, reason: string) => Promise<string | null>;
}

export function RxDetailSheet({
  rx,
  onClose,
  onValidate,
  onDispense,
  onCancel,
}: RxDetailSheetProps) {
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');
  const [printTemplate, setPrintTemplate] = useState<"prescriptions" | "medications" | null>(null);
  const { facility: pdfFacility, settings: pdfSettings } = usePdfBranding();
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  if (!rx) return null;

  const pdfPrescriptionData = {
    patientName: rx.patientName,
    patientAge: "",
    patientGender: "",
    date: format(new Date(rx.date), "PPP"),
    prescriptionId: rx.id.slice(0, 8).toUpperCase(),
    doctorName: rx.prescriber,
    doctorSpecialty: "",
    medications: rx.itemsData.map((item) => ({
      name: item.name ?? item.drug ?? "",
      dosage: item.dosage ?? item.dose ?? "",
      frequency: item.frequency ?? "",
      duration: item.duration ?? "",
      instructions: item.instructions ?? "",
    })),
  };

  // Patient sheet: the same lines, as the prescriber wrote them (MedicationGuideTemplate).
  const pdfGuideData: MedicationGuideData = {
    patientName: rx.patientName,
    prescriber: rx.prescriber,
    date: pdfPrescriptionData.date,
    medications: pdfPrescriptionData.medications,
  };

  return (
    <>
    <Sheet open={!!rx} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg flex items-center gap-2">
                {t('rx_id')} {rx.id.slice(0, 8)}
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                  rx.status === 'Pending Queue' ? "bg-yellow-100 text-yellow-700" :
                  rx.status === 'Validated' ? "bg-blue-100 text-blue-700" :
                  rx.status === 'Cancelled' ? "bg-red-100 text-red-700" :
                  "bg-green-100 text-green-700"
                )}>
                  {rx.status}
                </span>
              </SheetTitle>
              <SheetDescription className="text-xs mt-1">
                {rx.prescriber} - {format(new Date(rx.date), "PPP 'at' p")}
              </SheetDescription>
            </div>
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
            {rx.patientId && (
              <Link href={`/patients/${rx.patientId}`}>
                <Button variant="outline" size="sm" className="text-xs h-7">{tc('view')}</Button>
              </Link>
            )}
          </div>


          <div>
            <h4 className="text-[10px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1 mb-2 tracking-widest">{t('order_details')}</h4>
            <div className="space-y-2">
              {rx.itemsData?.map((item, i) => (
                <div key={i} className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-slate-900">{item.drug || item.name}</div>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-[4px] text-[9px] uppercase font-bold",
                          item.stockStatus === 'in_stock' ? "bg-green-50 text-green-700 border border-green-100" :
                          item.stockStatus === 'out_of_stock' ? "bg-red-50 text-red-700 border border-red-100" :
                          "bg-slate-50 text-slate-500 border border-slate-100"
                        )}>
                          {item.stockStatus === 'in_stock' ? t('in_stock') : 
                           item.stockStatus === 'out_of_stock' ? t('out_of_stock_label') : 
                           t('not_in_inventory')}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{item.dosage || item.dose} — {item.frequency}</div>
                      {item.unitPrice && (
                        <div className="text-[10px] text-blue-600 font-medium mt-1">
                          {item.unitPrice.toLocaleString()} XAF / unit
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{t('qty')}</div>
                      <div className="text-sm font-mono font-semibold">{item.quantity || "—"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(rx.status === 'Validated' || rx.status === 'Dispensed') && rx.invoiceId && (
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-blue-900 uppercase tracking-widest">Facturation</h4>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] uppercase font-bold border",
                  rx.invoiceStatus === 'paid' ? "bg-green-100 text-green-700 border-green-200" : "bg-yellow-100 text-yellow-700 border-yellow-200"
                )}>
                  {rx.invoiceStatus === 'paid' ? t('invoice_paid') : t('invoice_pending')}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">ID Facture</span>
                  <span className="font-mono text-slate-700">{rx.invoiceId}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-blue-100">
                  <span className="text-slate-900">{tc('total')}</span>
                  <span className="text-blue-700">{rx.invoiceTotal?.toLocaleString()} XAF</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Link href={`/billing/${rx.invoiceId}`} className="flex-1">
                  <Button
                    size="sm"
                    className="w-full h-8 text-[10px] bg-blue-600 hover:bg-blue-700"
                  >
                    <Receipt className="mr-2 h-3 w-3" /> {t('view_invoice')}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="p-4 border-t border-slate-200 bg-slate-100 shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] justify-between items-center sm:justify-between flex-row">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">{t('total_cost')}</span>
            <span className="text-sm font-bold text-slate-900">{rx.totalCost?.toLocaleString() || 0} <span className="text-[10px]">XAF</span></span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="text-xs h-8" onClick={() => setPrintTemplate("prescriptions")}>
              <Printer className="mr-2 h-3.5 w-3.5" /> {tc('print')}
            </Button>
            <Button variant="outline" className="text-xs h-8" onClick={() => setPrintTemplate("medications")}>
              <FileText className="mr-2 h-3.5 w-3.5" /> {t('patient_sheet')}
            </Button>
            {rx.status === 'Pending Queue' && (
              <>
                <Button
                  variant="outline"
                  className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => {
                    setCancelReason("");
                    setCancelError(null);
                    setIsCancelOpen(true);
                  }}
                >
                  <X className="mr-2 h-3.5 w-3.5" /> {tc('cancel')}
                </Button>
                <Button 
                  className="text-xs h-8 bg-blue-600 hover:bg-blue-700" 
                  onClick={() => onValidate(rx.id)}
                  disabled={!rx.itemsData.some(i => i.stockStatus === 'in_stock')}
                >
                  <Check className="mr-2 h-3.5 w-3.5" /> {t('validate')}
                </Button>
              </>
            )}
            {rx.status === 'Validated' && (() => {
              const paymentBlocking = Boolean(rx.invoiceId) && rx.invoiceStatus !== 'paid';
              return (
                <Button
                  className={cn(
                    "text-xs h-8 text-white",
                    paymentBlocking ? "bg-slate-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                  )}
                  onClick={() => !paymentBlocking && onDispense(rx.id)}
                  disabled={paymentBlocking}
                >
                  <PillBottle className="mr-2 h-3.5 w-3.5" />
                  {paymentBlocking ? t('payment_required') : t('dispense')}
                </Button>
              );
            })()}
            {rx.status === 'Dispensed' && (
              <span className="text-xs font-bold uppercase tracking-wider text-green-700 flex items-center px-4 py-1.5 bg-green-100 rounded">
                <Check className="mr-2 h-4 w-4" /> {t('fulfilled')}
              </span>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    <Dialog open={isCancelOpen} onOpenChange={(open) => !isCancelling && setIsCancelOpen(open)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('cancel_rx_title')}</DialogTitle>
            <DialogDescription>{t('cancel_rx_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {cancelError && <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{cancelError}</div>}
            <label className="text-[11px] font-semibold text-slate-600">{t('cancel_rx_reason')}</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              maxLength={1000}
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isCancelling} onClick={() => setIsCancelOpen(false)}>{tc('close')}</Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isCancelling || !cancelReason.trim()}
              onClick={async () => {
                setIsCancelling(true);
                setCancelError(null);
                const error = await onCancel(rx.id, cancelReason.trim());
                setIsCancelling(false);
                if (error) {
                  setCancelError(error);
                  return;
                }
                setIsCancelOpen(false);
                onClose();
              }}
            >
              {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
              {t('cancel_rx_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PDFPreviewModal
      isOpen={printTemplate !== null}
      onClose={() => setPrintTemplate(null)}
      templateId={printTemplate ?? "prescriptions"}
      data={printTemplate === "medications" ? pdfGuideData : pdfPrescriptionData}
      facility={pdfFacility}
      settings={pdfSettings}
    />
    </>
  );
}
