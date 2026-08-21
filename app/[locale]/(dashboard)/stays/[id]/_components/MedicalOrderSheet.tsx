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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Stethoscope, Loader2 } from "lucide-react";
import { Doctor } from "../types";

interface MedicalOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function MedicalOrderSheet({
  open,
  onOpenChange,
  doctors,
  submitting,
  onSubmit,
}: MedicalOrderSheetProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[450px] p-0 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-8 pb-32">
            <SheetHeader className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 border border-indigo-100 shadow-sm">
                <Stethoscope className="h-6 w-6 text-indigo-600" />
              </div>
              <SheetTitle className="text-2xl font-bold tracking-tight">{t('new_order')}</SheetTitle>
              <SheetDescription className="text-slate-500 leading-relaxed">{t('new_order_desc')}</SheetDescription>
            </SheetHeader>
            
            <form id="order-form" onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('prescriber_id')}</Label>
                <Select
                  name="prescriberId"
                  items={doctors.map((doc) => ({ value: doc.id, label: `Dr. ${doc.fullName}` }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-slate-900 transition-all">
                    <SelectValue placeholder={t('prescriber_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>Dr. {doc.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('order_type')}</Label>
                <Select
                  name="type"
                  defaultValue="biology"
                  items={[
                    { value: "biology", label: t('order_type_biology') },
                    { value: "radiology", label: t('order_type_radiology') },
                    { value: "pathology", label: t('order_type_pathology') },
                    { value: "cardiology", label: t('order_type_cardiology') },
                    { value: "other", label: t('order_type_other') },
                  ]}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-slate-900 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="biology">{t('order_type_biology')}</SelectItem>
                    <SelectItem value="radiology">{t('order_type_radiology')}</SelectItem>
                    <SelectItem value="pathology">{t('order_type_pathology')}</SelectItem>
                    <SelectItem value="cardiology">{t('order_type_cardiology')}</SelectItem>
                    <SelectItem value="other">{t('order_type_other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('exam_label')}</Label>
                <Input id="examLabel" name="examLabel" placeholder={t('exam_label_placeholder')} className="h-11 rounded-xl border-slate-200 focus:ring-slate-900 transition-all" required />
              </div>

              <div className="space-y-2.5">
                <Label>{t('urgency')}</Label>
                <Select
                  name="urgency"
                  defaultValue="routine"
                  items={[
                    { value: "routine", label: t('urgency_routine') },
                    { value: "urgent", label: t('urgency_urgent') },
                    { value: "stat", label: t('urgency_stat') },
                  ]}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-slate-900 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">{t('urgency_routine')}</SelectItem>
                    <SelectItem value="urgent">{t('urgency_urgent')}</SelectItem>
                    <SelectItem value="stat">{t('urgency_stat')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('order_notes')}</Label>
                <textarea 
                  id="notes" 
                  name="notes" 
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition-all"
                  placeholder={t('order_notes_placeholder')}
                />
              </div>
            </form>
          </div>
        </ScrollArea>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          <Button form="order-form" type="submit" size="lg" className="h-12 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-bold shadow-lg shadow-slate-100 transition-all active:scale-95 text-white" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : null}
            {t('save_order')}
          </Button>
          <Button variant="ghost" className="h-11 w-full rounded-xl text-slate-500 font-medium" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
