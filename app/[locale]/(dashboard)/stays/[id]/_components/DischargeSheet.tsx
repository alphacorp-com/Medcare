"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface DischargeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function DischargeSheet({
  open,
  onOpenChange,
  submitting,
  onSubmit,
}: DischargeSheetProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[450px] p-0 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-8 pb-32">
            <SheetHeader className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4 border border-red-100 shadow-sm">
                <LogOut className="h-6 w-6 text-red-600" />
              </div>
              <SheetTitle className="text-2xl font-bold tracking-tight text-slate-900">{t('discharge_patient')}</SheetTitle>
              <SheetDescription className="text-slate-500 leading-relaxed">{t('discharge_desc')}</SheetDescription>
            </SheetHeader>
            
            <form id="discharge-form" onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('discharge_date_label')}</Label>
                <Input id="dischargeDate" name="dischargeDate" type="datetime-local" defaultValue={format(new Date(), "yyyy-MM-dd'T'HH:mm")} className="h-11 rounded-xl border-slate-200 focus:ring-slate-900" required />
              </div>
              
              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('discharge_summary_label')}</Label>
                <textarea 
                  id="dischargeSummary" 
                  name="dischargeSummary" 
                  className="min-h-[250px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition-all"
                  placeholder={t('discharge_summary_placeholder')}
                  required
                />
              </div>
            </form>
          </div>
        </ScrollArea>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          <Button form="discharge-form" type="submit" size="lg" className="h-12 w-full rounded-xl bg-red-600 hover:bg-red-700 text-sm font-bold shadow-lg shadow-red-100 transition-all active:scale-95 text-white" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : null}
            {t('confirm_discharge')}
          </Button>
          <Button variant="ghost" className="h-11 w-full rounded-xl text-slate-500 font-medium" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
