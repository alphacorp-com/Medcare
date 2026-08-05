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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Loader2 } from "lucide-react";
import { VitalsFields, VitalsForm } from "@/components/shared/vitals-fields";

interface VitalsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: VitalsForm;
  onChange: (next: VitalsForm) => void;
  submitting: boolean;
  onSubmit: () => Promise<void>;
}

export function VitalsSheet({
  open,
  onOpenChange,
  value,
  onChange,
  submitting,
  onSubmit,
}: VitalsSheetProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[450px] p-0 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-8 pb-32">
            <SheetHeader className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <SheetTitle className="text-2xl font-bold tracking-tight text-slate-900">{t('add_vitals')}</SheetTitle>
              <SheetDescription className="text-slate-500 leading-relaxed">{t('add_vitals_desc')}</SheetDescription>
            </SheetHeader>

            <VitalsFields value={value} onChange={onChange} />
          </div>
        </ScrollArea>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold shadow-lg shadow-blue-100 transition-all active:scale-95 text-white"
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : null}
            {t('save_vitals')}
          </Button>
          <Button variant="ghost" className="h-11 w-full rounded-xl text-slate-500 font-medium" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
