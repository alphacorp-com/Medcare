"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Loader2, UserMinus } from "lucide-react";
import { StaffMember } from "../types";

export function DeclareAbsenceDialog({
  open,
  onOpenChange,
  staff,
  onDeclared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember[];
  onDeclared: () => void;
}) {
  const t = useTranslations("planning");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");

  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  const reset = () => {
    setUserId("");
    setFrom("");
    setTo("");
    setReason("");
    setError(null);
    setResult(null);
  };

  const handleConfirm = async () => {
    if (!userId || !from || !to || !reason.trim()) {
      setError(t("absence_fields_required"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/planning/schedules/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, from, to, reason }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || t("absence_error"));
        return;
      }
      setResult(payload.affected);
      onDeclared();
    } catch (err) {
      setError(t("absence_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-800">
            <UserMinus className="h-4 w-4 text-orange-600" /> {t("declare_absence")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          {result !== null ? (
            <p className="text-sm text-slate-700">{result === 0 ? t("absence_result_zero") : t("absence_result", { count: result })}</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label>{t("staff_member")}</Label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                >
                  <option value="" disabled>{t("select_staff")}</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName} ({tr(s.role)})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("from")}</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label>{t("to")}</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("reason")}</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("absence_reason_placeholder")} className="h-9 text-xs" />
              </div>
              <div className="p-3 bg-red-50 border border-red-100 rounded text-xs text-red-800 flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
                <span>{t("absence_warning")}</span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{result !== null ? t("close") : tc("cancel")}</Button>
          {result === null && (
            <Button disabled={isSaving} onClick={handleConfirm} className="bg-orange-600 text-white hover:bg-orange-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("confirm_absence")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
