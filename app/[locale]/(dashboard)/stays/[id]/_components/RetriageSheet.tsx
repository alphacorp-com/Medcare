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
  SheetFooter,
} from "@/components/ui/sheet";
import { Siren, Loader2 } from "lucide-react";
import { TRIAGE_ACUITIES, type TriageAcuity } from "@/components/shared/triage-badge";
import { StayDetail } from "../types";

interface RetriageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stay: StayDetail;
  submitting: boolean;
  onSubmit: (acuity: TriageAcuity) => Promise<void>;
}

export function RetriageSheet({ open, onOpenChange, stay, submitting, onSubmit }: RetriageSheetProps) {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");
  const [acuity, setAcuity] = useState<TriageAcuity>(stay.triageAcuity ?? "urgent");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-sm w-full right-0 p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center mb-2 border border-red-100">
            <Siren className="h-5 w-5 text-red-600" />
          </div>
          <SheetTitle className="text-lg">{t("retriage")}</SheetTitle>
          <SheetDescription className="text-xs">{t("retriage_desc")}</SheetDescription>
        </SheetHeader>

        <div className="p-4 flex-1 overflow-y-auto space-y-1.5">
          {TRIAGE_ACUITIES.map((level) => (
            <label
              key={level}
              className={`flex items-center gap-2 border rounded p-2 cursor-pointer bg-white shadow-sm ${
                acuity === level ? "border-blue-400 ring-1 ring-blue-300" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="acuity"
                className="hidden"
                checked={acuity === level}
                onChange={() => setAcuity(level)}
              />
              <span className={`text-[11px] font-bold uppercase ${
                level === "resuscitation" ? "text-red-600" :
                level === "emergent" ? "text-orange-600" :
                level === "urgent" ? "text-yellow-600" :
                level === "less_urgent" ? "text-blue-600" : "text-slate-500"
              }`}>
                {t(level)}
              </span>
            </label>
          ))}
        </div>

        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button
            className="text-xs h-8 bg-blue-600 hover:bg-blue-700"
            disabled={submitting}
            onClick={() => onSubmit(acuity)}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
            {t("confirm_retriage")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
