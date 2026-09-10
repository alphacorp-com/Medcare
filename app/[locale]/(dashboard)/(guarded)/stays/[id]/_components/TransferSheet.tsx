"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Department, Doctor, Bed, StayDetail } from "../types";

interface TransferSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stay: StayDetail;
  departments: Department[];
  doctors: Doctor[];
  beds: Bed[];
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function TransferSheet({
  open,
  onOpenChange,
  stay,
  departments,
  doctors,
  beds,
  submitting,
  onSubmit,
}: TransferSheetProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');
  const [deptId, setDeptId] = useState(stay.departmentId || "");
  const [bedId, setBedId] = useState(stay.bedId || "");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[450px] p-0 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-8 pb-32">
            <SheetHeader className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                <ArrowRightLeft className="h-6 w-6 text-slate-600" />
              </div>
              <SheetTitle className="text-2xl font-bold tracking-tight">{t('transfer_bed')}</SheetTitle>
              <SheetDescription className="text-slate-500 leading-relaxed">{t('transfer_bed_desc')}</SheetDescription>
            </SheetHeader>
            
            <form id="transfer-form" onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('new_dept_id')}</Label>
                <Select
                  name="departmentId"
                  value={deptId}
                  onValueChange={(v) => { setDeptId(v ?? ""); setBedId(""); }}
                  items={departments.map((dept) => ({ value: dept.id, label: `${dept.name} (${dept.code})` }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-slate-900 transition-all">
                    <SelectValue placeholder={t('new_dept_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name} ({dept.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('new_bed_id')}</Label>
                <Select
                  name="bedId"
                  value={bedId}
                  onValueChange={(v) => setBedId(v ?? "")}
                  disabled={!deptId}
                  items={beds
                    .filter((b) => b.departmentId === deptId && (b.status === "available" || b.id === stay.bedId))
                    .map((b) => ({ value: b.id, label: b.label }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-slate-900 transition-all">
                    <SelectValue placeholder={t('new_bed_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {beds
                      .filter((b) => b.departmentId === deptId && (b.status === "available" || b.id === stay.bedId))
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('attending_doctor_id')}</Label>
                <Select
                  name="attendingDoctorId"
                  defaultValue={stay.attendingDoctorId || ""}
                  items={doctors.map((doc) => ({
                    value: doc.id,
                    label: `Dr. ${doc.fullName}${doc.specialty ? ` — ${doc.specialty}` : ""}`,
                  }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-slate-900 transition-all">
                    <SelectValue placeholder={t('attending_doctor_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>Dr. {doc.fullName} {doc.specialty ? `— ${doc.specialty}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </form>
          </div>
        </ScrollArea>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          <Button form="transfer-form" type="submit" size="lg" className="h-12 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-bold shadow-lg shadow-slate-100 transition-all active:scale-95" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('confirm_transfer')}
          </Button>
          <Button variant="ghost" className="h-11 w-full rounded-xl text-slate-500 font-medium" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
