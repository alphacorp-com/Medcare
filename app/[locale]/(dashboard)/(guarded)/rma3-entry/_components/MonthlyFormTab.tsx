"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Lock, LockOpen, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/useAppStore";
import { BREAKDOWN_COLUMNS, RMA3_MANUAL_SECTIONS, type Rma3ManualIndicator } from "@/lib/rma3-manual/catalog";
import { previousMonth, selectClass, useRma3ApiError } from "./shared";

// The RMA3 monthly form: the figures no transaction records, entered once a month, then
// validated (locked). The server checks every permission and value again.

type Form = {
  period: string;
  status: "draft" | "validated";
  validatedAt: string | null;
  updatedAt: string | null;
  values: Record<string, Record<string, number>>;
};

const cellId = (code: string, key: string) => `${code}|${key}`;

// Rows of a section grouped by breakdown, so each group shares one header.
function groupByBreakdown(indicators: readonly Rma3ManualIndicator[]) {
  return indicators.reduce<Rma3ManualIndicator[][]>((groups, indicator) => {
    const last = groups[groups.length - 1];
    if (last && last[0].breakdown === indicator.breakdown) last.push(indicator);
    else groups.push([indicator]);
    return groups;
  }, []);
}

export function MonthlyFormTab() {
  const t = useTranslations("rma3Entry");
  const format = useFormatter();
  const apiError = useRma3ApiError();
  const queryClient = useQueryClient();
  const hasPermission = useAppStore((state) => state.hasPermission);
  const isAdmin = useAppStore((state) => state.currentUser?.isSystemAdmin === true);
  const [month, setMonth] = useState(previousMonth);
  const period = month.replace("-", "");
  // Edited cells, as typed ("" = clear the cell), until saved.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState("");

  const queryKey = ["rma3-entry", period];
  const query = useQuery({ queryKey, queryFn: () => apiFetch<{ data: Form }>(`/api/v1/rma3-entry/${period}`) });
  const form = query.data?.data;
  const locked = form?.status === "validated";
  const canEdit = hasPermission("MODULE_RMA3", "update") && !locked;
  const canValidate = hasPermission("MODULE_RMA3", "validate");

  const totalCells = useMemo(() => RMA3_MANUAL_SECTIONS.flatMap((s) => s.indicators).reduce((n, i) => n + BREAKDOWN_COLUMNS[i.breakdown].length, 0), []);
  const filledCells = form ? Object.values(form.values).reduce((n, cells) => n + Object.keys(cells).length, 0) : 0;
  const dirtyCount = Object.keys(draft).length;

  const onSaved = (data: Form) => {
    queryClient.setQueryData(queryKey, { data });
    setDraft({});
  };

  const save = useMutation({
    mutationFn: () => {
      const values = Object.entries(draft).map(([id, raw]) => {
        const [code, key] = id.split("|");
        return { code, key, value: raw.trim() === "" ? null : Number(raw) };
      });
      return apiFetch<{ data: Form }>(`/api/v1/rma3-entry/${period}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values }) });
    },
    onSuccess: ({ data }) => {
      onSaved(data);
      toast.success(t("saved"));
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const validate = useMutation({
    mutationFn: () => apiFetch<{ data: Form }>(`/api/v1/rma3-entry/${period}/validate`, { method: "POST" }),
    onSuccess: ({ data }) => {
      onSaved(data);
      setConfirmValidate(false);
      toast.success(t("validated_toast"));
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const reopen = useMutation({
    mutationFn: () =>
      apiFetch<{ data: Form }>(`/api/v1/rma3-entry/${period}/reopen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }),
    onSuccess: ({ data }) => {
      onSaved(data);
      setReopenOpen(false);
      setReason("");
      toast.success(t("reopened_toast"));
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const changeMonth = (value: string) => {
    if (dirtyCount > 0 && !window.confirm(t("discard_confirm"))) return;
    setDraft({});
    setMonth(value);
  };

  const shown = (code: string, key: string): string => {
    const id = cellId(code, key);
    if (id in draft) return draft[id];
    const value = form?.values[code]?.[key];
    return value === undefined ? "" : String(value);
  };

  const edit = (code: string, key: string, raw: string) => {
    const id = cellId(code, key);
    const stored = form?.values[code]?.[key];
    setDraft((current) => {
      const next = { ...current };
      // Back to the stored value: no longer a change.
      if (raw === (stored === undefined ? "" : String(stored))) delete next[id];
      else next[id] = raw;
      return next;
    });
  };

  const renderCell = (indicator: Rma3ManualIndicator, key: string) => {
    const value = shown(indicator.code, key);
    const changed = cellId(indicator.code, key) in draft;
    if (indicator.kind === "yesNo") {
      return (
        <select value={value} disabled={!canEdit} onChange={(e) => edit(indicator.code, key, e.target.value)} className={cn(selectClass, "w-24", changed && "ring-1 ring-amber-400")}>
          <option value="">—</option>
          <option value="1">{t("yes")}</option>
          <option value="0">{t("no")}</option>
        </select>
      );
    }
    return (
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        disabled={!canEdit}
        placeholder="—"
        onChange={(e) => edit(indicator.code, key, e.target.value)}
        className={cn("h-8 text-right text-xs font-mono", indicator.kind === "amount" ? "w-36" : "w-20", changed && "ring-1 ring-amber-400")}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-[10px] font-bold uppercase text-slate-500">{t("month")}</span>
          <Input type="month" value={month} max={new Date().toISOString().slice(0, 7)} onChange={(e) => e.target.value && changeMonth(e.target.value)} className="h-8 w-40 text-xs" />
        </label>
        {form && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", locked ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              {locked ? <Lock className="h-3 w-3" /> : null}
              {locked ? t("status_validated") : t("status_draft")}
            </span>
            {locked && form.validatedAt && <span className="text-slate-500">{t("validated_on", { date: format.dateTime(new Date(form.validatedAt), { dateStyle: "medium" }) })}</span>}
            <span className="text-slate-500">{t("filled", { filled: filledCells, total: totalCells })}</span>
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button size="sm" variant="outline" disabled={dirtyCount === 0 || save.isPending} onClick={() => setDraft({})}>
                <Undo2 className="h-3.5 w-3.5" /> {t("discard")}
              </Button>
              <Button size="sm" disabled={dirtyCount === 0 || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t("save")}
                {dirtyCount > 0 && ` (${dirtyCount})`}
              </Button>
            </>
          )}
          {!locked && canValidate && form && (
            <Button size="sm" variant="outline" disabled={dirtyCount > 0} title={dirtyCount > 0 ? t("save_first") : undefined} onClick={() => setConfirmValidate(true)}>
              <Lock className="h-3.5 w-3.5" /> {t("validate")}
            </Button>
          )}
          {locked && isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setReopenOpen(true)}>
              <LockOpen className="h-3.5 w-3.5" /> {t("reopen")}
            </Button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500">{locked ? t("locked_hint") : t("not_entered_hint")}</p>

      {query.isLoading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
      {query.isError && <p className="text-xs text-red-600">{apiError(query.error)}</p>}

      {form &&
        RMA3_MANUAL_SECTIONS.map((section) => (
          <section key={section.code} className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">
              <span className="font-mono text-xs text-slate-400">{section.code.replace(/-[RD]$/, "")}</span> {section.title}
            </h2>
            {groupByBreakdown(section.indicators).map((group) => {
              const columns = BREAKDOWN_COLUMNS[group[0].breakdown];
              const single = columns.length === 1;
              return (
                <div key={group[0].code} className="overflow-x-auto rounded border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] text-slate-500">
                      <tr>
                        <th className="sticky left-0 z-10 bg-slate-50 px-2 py-1.5 min-w-64">{t("indicator")}</th>
                        {columns.map((c) => (
                          <th key={c.key} className="px-2 py-1.5 whitespace-nowrap">{single ? t("value") : c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.map((indicator) => (
                        <tr key={indicator.code}>
                          <td className="sticky left-0 z-10 bg-white px-2 py-1">
                            <span className="font-mono text-[10px] text-slate-400">{indicator.code}</span> {indicator.label}
                          </td>
                          {columns.map((c) => (
                            <td key={c.key} className="px-2 py-1">{renderCell(indicator, c.key)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>
        ))}

      <Dialog open={confirmValidate} onOpenChange={setConfirmValidate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("validate_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600">{t("validate_confirm", { filled: filledCells, total: totalCells })}</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmValidate(false)}>{t("cancel")}</Button>
            <Button size="sm" disabled={validate.isPending} onClick={() => validate.mutate()}>
              {validate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t("validate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("reopen_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600">{t("reopen_hint")}</p>
          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase text-slate-500">{t("reason")}</span>
            <textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="min-h-20 w-full rounded-md border border-slate-200 p-2 text-xs" />
          </label>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReopenOpen(false)}>{t("cancel")}</Button>
            <Button size="sm" disabled={reason.trim().length < 5 || reopen.isPending} onClick={() => reopen.mutate()}>
              {reopen.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t("reopen")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
