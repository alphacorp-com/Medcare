"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ClipboardCheck, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHECKLIST_ITEMS, CHECKLIST_PHASES, ChecklistPhase, isPhaseComplete } from "@/lib/surgery/checklist";
import { cn } from "@/lib/utils";
import { Surgery } from "../types";
import { SheetError, SurgerySheet } from "./SurgerySheetLayout";

const PHASE_ALLOWED_STATUS: Record<ChecklistPhase, Surgery["status"]> = {
  signIn: "scheduled",
  timeOut: "scheduled",
  signOut: "in_progress",
};

// WHO Surgical Safety Checklist, phase by phase. Each item is ticked consciously — there is
// deliberately no "tick everything" shortcut.
export function ChecklistSheet({
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

  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [savingPhase, setSavingPhase] = useState<ChecklistPhase | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!surgery) return null;

  const savePhase = async (phase: ChecklistPhase) => {
    setSavingPhase(phase);
    setError(null);
    try {
      const items = Object.fromEntries(CHECKLIST_ITEMS[phase].map((key) => [key, Boolean(draft[key])]));
      const res = await fetch(`/api/v1/surgeries/${surgery.id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, items }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("checklist_save_error"));
        return;
      }
      onUpdated();
    } catch {
      setError(t("checklist_save_error"));
    } finally {
      setSavingPhase(null);
    }
  };

  const completedPhases = CHECKLIST_PHASES.filter((phase) => isPhaseComplete(phase, surgery.whoChecklist?.[phase])).length;

  return (
    <SurgerySheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("who_checklist")}
      description={t("who_checklist_desc")}
      surgery={surgery}
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("close")}
        </Button>
      }
    >
      <SheetError message={error} />

      {/* Progress across the three moments of the checklist. */}
      <ol className="grid grid-cols-3 gap-2" aria-label={t("who_checklist")}>
        {CHECKLIST_PHASES.map((phase, index) => {
          const complete = isPhaseComplete(phase, surgery.whoChecklist?.[phase]);
          return (
            <li key={phase} className={cn("rounded-lg border px-2 py-2 text-center", complete ? "border-green-200 bg-green-50" : "border-slate-200 bg-white")}>
              <div className={cn("mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", complete ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600")}>
                {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <div className="text-[11px] font-semibold text-slate-700">{t(`phase_${phase}`)}</div>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-slate-500">{t("checklist_progress", { done: completedPhases, total: CHECKLIST_PHASES.length })}</p>

      {CHECKLIST_PHASES.map((phase) => {
        const state = surgery.whoChecklist?.[phase];
        const complete = isPhaseComplete(phase, state);
        const editable = surgery.status === PHASE_ALLOWED_STATUS[phase] && !complete;
        const keys = CHECKLIST_ITEMS[phase];
        const ticked = keys.filter((key) => (complete ? state?.items?.[key] : draft[key])).length;

        return (
          <section key={phase} className={cn("rounded-xl border bg-white shadow-sm", complete ? "border-green-200" : "border-slate-200")}>
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className={cn("h-4 w-4", complete ? "text-green-600" : "text-blue-600")} />
                <h3 className="text-sm font-semibold text-slate-900">{t(`phase_${phase}`)}</h3>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", complete ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>
                {ticked}/{keys.length}
              </span>
            </header>
            <div className="divide-y divide-slate-100">
              {keys.map((itemKey) => {
                const checked = complete ? Boolean(state?.items?.[itemKey]) : Boolean(draft[itemKey]);
                return (
                  <label
                    key={itemKey}
                    className={cn("flex items-center gap-3 px-4 py-2.5 text-sm", editable ? "cursor-pointer hover:bg-slate-50" : "cursor-default text-slate-500")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!editable}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [itemKey]: e.target.checked }))}
                      className="h-5 w-5 rounded border-slate-300 accent-blue-600"
                    />
                    <span className={cn(checked && "text-slate-900")}>{t(`checklist_items.${itemKey}`)}</span>
                  </label>
                );
              })}
            </div>
            <footer className="px-4 py-3">
              {complete ? (
                <p className="text-[11px] text-green-700">
                  {t("recorded_by", { name: userName(state?.completedBy ?? null), date: state?.completedAt ? new Date(state.completedAt).toLocaleString() : "" })}
                </p>
              ) : editable ? (
                <Button
                  size="sm"
                  className="h-8 bg-blue-600 text-white hover:bg-blue-700"
                  disabled={savingPhase === phase || ticked < keys.length}
                  onClick={() => savePhase(phase)}
                >
                  {savingPhase === phase ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                  {t("validate_phase")}
                </Button>
              ) : (
                <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Lock className="h-3 w-3" /> {t("checklist_not_yet_editable")}
                </p>
              )}
            </footer>
          </section>
        );
      })}
    </SurgerySheet>
  );
}
