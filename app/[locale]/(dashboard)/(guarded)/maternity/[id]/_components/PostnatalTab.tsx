"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Baby, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMaternityError } from "@/components/maternity/use-maternity-error";
import type { PregnancyDetail } from "../../types";

const HOUR = 3_600_000;
const DAY = 86_400_000;

// RMA3 contact of a post-natal visit (same windows as lib/reports/rma3-mother-child).
function contactKey(deliveryDate: string, visitDate: string): "h48" | "d6to10" | "w6" | "other" {
  const elapsed = new Date(visitDate).getTime() - new Date(deliveryDate).getTime();
  if (elapsed <= 48 * HOUR) return "h48";
  const days = Math.floor(elapsed / DAY);
  if (days >= 6 && days <= 10) return "d6to10";
  if (days >= 35 && days <= 49) return "w6";
  return "other";
}

const FLAGS = ["vitaminAGiven", "ironFolateGiven", "breastfeedingCounseling", "newbornExamined"] as const;

export function PostnatalTab({ pregnancy, onUpdated }: { pregnancy: PregnancyDetail; onUpdated: () => void }) {
  const t = useTranslations("maternity");
  const format = useFormatter();
  const [isOpen, setIsOpen] = useState(false);
  const deliveryDate = pregnancy.delivery?.deliveryDate;

  if (!deliveryDate) {
    return (
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
        <Baby className="h-10 w-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm text-slate-500">{t("complete_delivery_first")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{t("postnatal_visits")}</h3>
        <Button size="sm" className="h-8 text-xs bg-pink-600 hover:bg-pink-700" onClick={() => setIsOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_postnatal_visit")}
        </Button>
      </div>
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2">{t("visit_date")}</th>
              <th className="px-4 py-2">{t("postnatal_contact")}</th>
              <th className="px-4 py-2">{t("postnatal_care")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pregnancy.postnatalVisits.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400 italic">{t("no_postnatal_visits")}</td>
              </tr>
            ) : (
              pregnancy.postnatalVisits.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 text-slate-600">{format.dateTime(new Date(v.visitDate), { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-4 py-2 text-slate-600">{t(`postnatal_contact_${contactKey(deliveryDate, v.visitDate)}`)}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {FLAGS.filter((f) => v[f]).map((f) => (
                        <span key={f} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">{t(`pnc_${f}`)}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {isOpen && <PostnatalVisitDialog pregnancyId={pregnancy.id} onOpenChange={setIsOpen} onSaved={onUpdated} />}
    </div>
  );
}

function PostnatalVisitDialog({ pregnancyId, onOpenChange, onSaved }: { pregnancyId: string; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const t = useTranslations("maternity");
  const tc = useTranslations("common");
  const errorMessage = useMaternityError();
  const [visitDate, setVisitDate] = useState("");
  const [flags, setFlags] = useState<Record<(typeof FLAGS)[number], boolean>>({ vitaminAGiven: false, ironFolateGiven: false, breastfeedingCounseling: false, newbornExamined: true });
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/maternity/pregnancies/${pregnancyId}/postnatal-visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Empty date = now.
        body: JSON.stringify({ visitDate: visitDate ? new Date(visitDate).toISOString() : undefined, ...flags, notes: notes || undefined }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(payload, t("visit_save_error")));
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError(t("visit_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("new_postnatal_visit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <div className="space-y-1">
            <Label>{t("visit_date")}</Label>
            <Input type="datetime-local" value={visitDate} max={new Date().toISOString().slice(0, 16)} onChange={(e) => setVisitDate(e.target.value)} className="h-9 text-xs" />
            <p className="text-[10px] text-slate-400">{t("postnatal_date_hint")}</p>
          </div>
          {FLAGS.map((f) => (
            <label key={f} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={flags[f]} onChange={(e) => setFlags((cur) => ({ ...cur, [f]: e.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
              {t(`pnc_${f}`)}
            </label>
          ))}
          <div className="space-y-1">
            <Label>{t("notes")}</Label>
            <textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} rows={2} className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={isSaving} onClick={handleSave} className="bg-pink-600 text-white hover:bg-pink-700">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
