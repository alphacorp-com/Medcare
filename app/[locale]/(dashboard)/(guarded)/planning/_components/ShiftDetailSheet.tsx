"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Trash2, UserMinus, Users } from "lucide-react";
import { ScheduleEntry, StaffMember } from "../types";

export function ShiftDetailSheet({
  open,
  onOpenChange,
  schedule,
  staff,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleEntry | null;
  staff: StaffMember[];
  onUpdated: () => void;
}) {
  const t = useTranslations("planning");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");

  const [busy, setBusy] = useState<"confirm" | "absent" | "delete" | "replace" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPickingReplacement, setIsPickingReplacement] = useState(false);
  const [replacementId, setReplacementId] = useState("");

  if (!schedule) return null;

  const staffMember = staff.find((s) => s.id === schedule.userId);
  const replacement = schedule.replacedBy ? staff.find((s) => s.id === schedule.replacedBy) : null;
  const eligibleReplacements = staff.filter((s) => s.id !== schedule.userId);

  const patch = async (body: Record<string, unknown>, action: typeof busy) => {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/v1/planning/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("action_error"));
        return;
      }
      onUpdated();
    } catch (err) {
      setError(t("action_error"));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/v1/planning/schedules/${schedule.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("action_error"));
        return;
      }
      onUpdated();
      onOpenChange(false);
    } catch (err) {
      setError(t("action_error"));
    } finally {
      setBusy(null);
    }
  };

  const handleReplace = async () => {
    if (!replacementId) return;
    setBusy("replace");
    setError(null);
    try {
      const res = await fetch(`/api/v1/planning/schedules/${schedule.id}/replace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replacementUserId: replacementId }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || t("action_error"));
        return;
      }
      setIsPickingReplacement(false);
      setReplacementId("");
      onUpdated();
    } catch (err) {
      setError(t("action_error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t(`shift_types.${schedule.shiftType}`)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div>
            <div className="text-sm font-bold text-slate-900">{staffMember?.fullName ?? "—"}</div>
            {staffMember && <div className="text-xs text-slate-500">{tr(staffMember.role)}</div>}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{format(new Date(schedule.date), "PPP")}</span>
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
              schedule.status === "planned" ? "bg-slate-100 text-slate-700" :
              schedule.status === "confirmed" ? "bg-blue-100 text-blue-700" :
              schedule.status === "modified" ? "bg-purple-100 text-purple-700" :
              schedule.status === "absent" ? "bg-red-100 text-red-700" :
              "bg-amber-100 text-amber-700"
            )}>
              {t(`status.${schedule.status}`)}
            </span>
          </div>

          {schedule.notes && <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2">{schedule.notes}</p>}

          {replacement && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              {t("covered_by", { name: replacement.fullName })}
            </p>
          )}

          {isPickingReplacement && (
            <div className="space-y-2 border border-slate-200 rounded p-3">
              <Label>{t("select_replacement")}</Label>
              <select
                value={replacementId}
                onChange={(e) => setReplacementId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                <option value="">{t("select_staff")}</option>
                {eligibleReplacements.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName} ({tr(s.role)})</option>
                ))}
              </select>
              <Button size="sm" disabled={!replacementId || busy === "replace"} onClick={handleReplace} className="bg-amber-600 text-white hover:bg-amber-700 w-full">
                {busy === "replace" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                {t("confirm_replacement")}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {(schedule.status === "planned") && (
            <Button size="sm" disabled={busy === "confirm"} onClick={() => patch({ status: "confirmed" }, "confirm")} className="bg-blue-600 text-white hover:bg-blue-700">
              {busy === "confirm" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-2" />}
              {t("confirm_shift")}
            </Button>
          )}
          {(schedule.status === "planned" || schedule.status === "confirmed" || schedule.status === "modified") && (
            <Button size="sm" variant="outline" disabled={busy === "absent"} onClick={() => patch({ status: "absent" }, "absent")} className="text-orange-700 border-orange-200 hover:bg-orange-50">
              {busy === "absent" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <UserMinus className="h-3.5 w-3.5 mr-2" />}
              {t("mark_absent")}
            </Button>
          )}
          {schedule.status === "absent" && !isPickingReplacement && (
            <Button size="sm" variant="outline" onClick={() => setIsPickingReplacement(true)} className="text-amber-700 border-amber-200 hover:bg-amber-50">
              <Users className="h-3.5 w-3.5 mr-2" /> {t("find_replacement")}
            </Button>
          )}
          {schedule.status !== "replaced" && (
            <Button size="sm" variant="outline" disabled={busy === "delete"} onClick={handleDelete} className="text-red-700 border-red-200 hover:bg-red-50">
              {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />}
              {tc("delete")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
