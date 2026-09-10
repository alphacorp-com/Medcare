"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle2, Loader2 } from "lucide-react";
import { CHECKLIST_ITEMS, CHECKLIST_PHASES, ChecklistPhase, isPhaseComplete } from "@/lib/surgery/checklist";
import { Surgery } from "../types";

const PHASE_ALLOWED_STATUS: Record<ChecklistPhase, Surgery["status"]> = {
  signIn: "scheduled",
  timeOut: "scheduled",
  signOut: "in_progress",
};

export function ChecklistSheet({
  open,
  onOpenChange,
  surgery,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surgery: Surgery | null;
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
    } catch (err) {
      setError(t("checklist_save_error"));
    } finally {
      setSavingPhase(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("who_checklist")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          {CHECKLIST_PHASES.map((phase) => {
            const state = surgery.whoChecklist?.[phase];
            const complete = isPhaseComplete(phase, state);
            const editable = surgery.status === PHASE_ALLOWED_STATUS[phase];

            return (
              <div key={phase} className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{t(`phase_${phase}`)}</h3>
                  {complete && (
                    <span className="inline-flex items-center text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> {t("checklist_complete")}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {CHECKLIST_ITEMS[phase].map((itemKey) => {
                    const checked = complete ? Boolean(state?.items?.[itemKey]) : Boolean(draft[itemKey]);
                    return (
                      <label key={itemKey} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!editable || complete}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [itemKey]: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {t(`checklist_items.${itemKey}`)}
                      </label>
                    );
                  })}
                </div>

                {!complete && editable && (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700"
                    disabled={savingPhase === phase}
                    onClick={() => savePhase(phase)}
                  >
                    {savingPhase === phase ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                    {tc("save_changes")}
                  </Button>
                )}
                {!complete && !editable && (
                  <p className="text-[10px] text-slate-400">{t("checklist_not_yet_editable")}</p>
                )}
                {complete && (
                  <p className="text-[10px] text-slate-400">
                    {t("checklist_completed_by", { date: state?.completedAt ? new Date(state.completedAt).toLocaleString() : "" })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
