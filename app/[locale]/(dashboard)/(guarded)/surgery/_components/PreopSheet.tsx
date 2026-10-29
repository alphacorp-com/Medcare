"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, FileSignature, Loader2, ShieldCheck, Siren, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPhaseComplete } from "@/lib/surgery/checklist";
import { startBlockers, type StartBlocker } from "@/lib/surgery/validation";
import { cn } from "@/lib/utils";
import { Surgery } from "../types";
import { FieldLabel, SheetError, SheetSection, SurgerySheet, surgeryInputClass } from "./SurgerySheetLayout";

// Before the intervention: informed consent and pre-anaesthesia visit, plus a summary of what
// still prevents "Start" (the WHO Sign In / Time Out are recorded in the checklist sheet).
export function PreopSheet({
  open,
  onOpenChange,
  surgery,
  userName,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surgery: Surgery | null;
  userName: (id: string | null) => string;
  onUpdated: () => void;
}) {
  const t = useTranslations("surgery");
  const tc = useTranslations("common");
  const [consentNotes, setConsentNotes] = useState("");
  const [preAnesthesiaNotes, setPreAnesthesiaNotes] = useState("");
  const [saving, setSaving] = useState<"consent" | "preAnesthesia" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!surgery) return null;

  const blockers = startBlockers(surgery, {
    signIn: isPhaseComplete("signIn", surgery.whoChecklist?.signIn),
    timeOut: isPhaseComplete("timeOut", surgery.whoChecklist?.timeOut),
  });
  const editable = surgery.status === "scheduled" || surgery.status === "postponed";

  const record = async (step: "consent" | "preAnesthesia") => {
    const notes = step === "consent" ? consentNotes : preAnesthesiaNotes;
    if (step === "preAnesthesia" && !notes.trim()) return setError(t("pre_anesthesia_notes_required"));
    setSaving(step);
    setError(null);
    try {
      const res = await fetch(`/api/v1/surgeries/${surgery.id}/preop`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, notes }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("preop_save_error"));
        return;
      }
      onUpdated();
    } catch {
      setError(t("preop_save_error"));
    } finally {
      setSaving(null);
    }
  };

  const READINESS: StartBlocker[] = ["consent", "preAnesthesia", "signIn", "timeOut"];

  return (
    <SurgerySheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("preop_title")}
      description={t("preop_desc")}
      surgery={surgery}
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("close")}
        </Button>
      }
    >
      <SheetError message={error} />

      <SheetSection icon={ShieldCheck} title={t("readiness_title")} tone={blockers.length === 0 ? "done" : "warning"}>
        {surgery.isEmergency && (
          <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            <Siren className="h-3.5 w-3.5" /> {t("emergency_preop_hint")}
          </p>
        )}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {READINESS.map((item) => {
            const waived = surgery.isEmergency && (item === "consent" || item === "preAnesthesia");
            const done = !blockers.includes(item);
            return (
              <li
                key={item}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                  done ? "border-green-200 bg-green-50 text-green-800" : "border-slate-200 bg-white text-slate-700"
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
                <span>{t(`readiness.${item}`)}</span>
                {waived && !(item === "consent" ? surgery.consentObtainedAt : surgery.preAnesthesiaAt) && (
                  <span className="ml-auto text-[10px] font-semibold uppercase text-red-600">{t("waived")}</span>
                )}
              </li>
            );
          })}
        </ul>
      </SheetSection>

      <SheetSection icon={FileSignature} title={t("consent_title")} hint={t("consent_hint")} tone={surgery.consentObtainedAt ? "done" : "default"}>
        {surgery.consentObtainedAt ? (
          <RecordedStep at={surgery.consentObtainedAt} by={userName(surgery.consentObtainedById)} notes={surgery.consentNotes} />
        ) : editable ? (
          <>
            <div>
              <FieldLabel>{t("consent_notes")}</FieldLabel>
              <textarea
                value={consentNotes}
                onChange={(e) => setConsentNotes(e.target.value)}
                rows={2}
                className={surgeryInputClass}
                placeholder={t("consent_notes_placeholder")}
              />
            </div>
            <Button size="sm" disabled={saving !== null} onClick={() => record("consent")} className="bg-blue-600 text-white hover:bg-blue-700">
              {saving === "consent" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSignature className="h-4 w-4 mr-2" />}
              {t("record_consent")}
            </Button>
          </>
        ) : (
          <p className="text-xs text-slate-500">{t("not_recorded")}</p>
        )}
      </SheetSection>

      <SheetSection icon={Stethoscope} title={t("pre_anesthesia_title")} hint={t("pre_anesthesia_hint")} tone={surgery.preAnesthesiaAt ? "done" : "default"}>
        {surgery.preAnesthesiaAt ? (
          <RecordedStep at={surgery.preAnesthesiaAt} by={userName(surgery.preAnesthesiaById)} notes={surgery.preAnesthesiaNotes} />
        ) : editable ? (
          <>
            <div>
              <FieldLabel required>{t("pre_anesthesia_notes")}</FieldLabel>
              <textarea
                value={preAnesthesiaNotes}
                onChange={(e) => setPreAnesthesiaNotes(e.target.value)}
                rows={4}
                className={surgeryInputClass}
                placeholder={t("pre_anesthesia_notes_placeholder")}
              />
            </div>
            <Button size="sm" disabled={saving !== null} onClick={() => record("preAnesthesia")} className="bg-blue-600 text-white hover:bg-blue-700">
              {saving === "preAnesthesia" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Stethoscope className="h-4 w-4 mr-2" />}
              {t("record_pre_anesthesia")}
            </Button>
          </>
        ) : (
          <p className="text-xs text-slate-500">{t("not_recorded")}</p>
        )}
      </SheetSection>
    </SurgerySheet>
  );
}

function RecordedStep({ at, by, notes }: { at: string; by: string; notes: string | null }) {
  const t = useTranslations("surgery");
  return (
    <div className="space-y-1 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-green-700">
        <CheckCircle2 className="h-4 w-4" /> {t("recorded_by", { name: by, date: new Date(at).toLocaleString() })}
      </p>
      {notes && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-slate-700">{notes}</p>}
    </div>
  );
}
