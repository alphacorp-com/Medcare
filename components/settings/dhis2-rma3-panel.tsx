"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Download, FileUp, Loader2, RefreshCw, Send, Sparkles, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/providers/confirm-provider";

const API = "/api/v1/settings/dhis2/rma3";
const MAX_FILE_BYTES = 3_000_000; // same ceiling as the server (3,000,000 characters)

interface Rma3Summary {
  period: string;
  manualStatus: string;
  target: { dataSetId: string; orgUnitId: string; hasCredentials: boolean } | null;
  values: number;
  toSend: number;
  unmappedCount: number;
  unmapped: { indicatorCode: string; label: string; tableKey: string; cellKey: string; cellLabel: string }[];
  collisions: { first: string; second: string }[];
  mappingsCount: number;
  dictionary: { total: number; produced: number };
}

interface Feedback {
  ok: boolean;
  message: string;
  details?: string[];
}

// "202610" for the month before today: the RMA3 of the current month is still being written.
function previousMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const toInputValue = (period: string) => `${period.slice(0, 4)}-${period.slice(4)}`;

// onSent: called after every send or simulation (the history lists them).
export function Dhis2Rma3Panel({ hasPassword, onSent }: { hasPassword: boolean; onSent?: () => void }) {
  const t = useTranslations("settings");
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);

  const [period, setPeriod] = useState(previousMonth);
  const [summary, setSummary] = useState<Rma3Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // Suggestions found by the last preview: applying them is a separate, explicit click.
  const [pendingProposals, setPendingProposals] = useState(0);

  // A server error code → its translated sentence (unknown codes fall back to the generic one).
  const errorText = useCallback(
    (code: string | undefined) => (code && t.has(`dhis2.rma3.errors.${code}`) ? t(`dhis2.rma3.errors.${code}`) : t("dhis2.rma3.errors.export_failed")),
    [t]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setPendingProposals(0);
    setLoadError(null);
    try {
      const res = await fetch(`${API}?period=${period}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSummary(null);
        setLoadError(errorText(data?.error));
        return;
      }
      setSummary(data as Rma3Summary);
    } catch {
      setSummary(null);
      setLoadError(t("dhis2.rma3.load_error"));
    } finally {
      setIsLoading(false);
    }
  }, [period, errorText, t]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const download = async (url: string, fileName: string) => {
    setBusy("download");
    setFeedback(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFeedback({ ok: false, message: errorText(data?.error) });
        return;
      }
      const href = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(href);
    } catch {
      setFeedback({ ok: false, message: t("dhis2.rma3.errors.export_failed") });
    } finally {
      setBusy(null);
    }
  };

  const importMapping = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setFeedback({ ok: false, message: errorText("csv_too_large") });
      return;
    }
    setBusy("import");
    setFeedback(null);
    try {
      const res = await fetch(`${API}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, csv: await file.text() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setFeedback({ ok: true, message: t("dhis2.rma3.import_done", { applied: data.applied, skipped: data.skipped }) });
        await load();
        return;
      }
      const lines = (data?.errors as { line: number; message: string }[] | undefined)?.map((e) => {
        const [key, arg] = e.message.split(":");
        const message = key === "missing_column" ? t("dhis2.rma3.errors.missing_column", { column: arg ?? "" }) : errorText(key);
        return t("dhis2.rma3.import_line", { line: e.line, message });
      });
      setFeedback({
        ok: false,
        message: lines ? t("dhis2.rma3.import_errors", { count: data.errorCount ?? lines.length }) : errorText(data?.error),
        details: lines,
      });
    } catch {
      setFeedback({ ok: false, message: t("dhis2.rma3.errors.export_failed") });
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const propose = async (apply: boolean) => {
    setBusy("propose");
    setFeedback(null);
    try {
      const res = await fetch(`${API}/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, apply }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ ok: false, message: errorText(data?.error) });
        return;
      }
      const sample = (data.sample as { indicatorCode: string; cellKey: string; elementName: string }[]).map(
        (p) => `${p.indicatorCode}${p.cellKey ? ` / ${p.cellKey}` : ""} → ${p.elementName}`
      );
      setFeedback({
        ok: true,
        message: apply
          ? t("dhis2.rma3.propose_applied", { applied: data.applied })
          : t("dhis2.rma3.propose_result", { proposals: data.proposals, cells: data.cells, elements: data.elements, noElement: data.noElement, ambiguous: data.ambiguousElement, noCombo: data.noCombo }),
        details: apply ? undefined : sample,
      });
      setPendingProposals(apply ? 0 : data.proposals);
      if (apply) await load();
    } catch {
      setFeedback({ ok: false, message: t("dhis2.rma3.errors.export_failed") });
    } finally {
      setBusy(null);
    }
  };

  const push = async (dryRun: boolean) => {
    if (!dryRun && !(await confirm({ message: t("dhis2.rma3.push_confirm", { period }), description: t("dhis2.rma3.push_confirm_desc") }))) return;
    setBusy("push");
    setFeedback(null);
    try {
      const res = await fetch(`${API}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, dryRun }),
      });
      const data = await res.json().catch(() => null);
      if (data?.importCount && res.ok) {
        const counts = { imported: data.importCount.imported, updated: data.importCount.updated, ignored: data.importCount.ignored };
        setFeedback({
          ok: true,
          message: t(dryRun ? "dhis2.rma3.push_dry_ok" : "dhis2.rma3.push_ok", counts),
          details: data.conflicts?.length ? [t("dhis2.rma3.conflicts", { count: data.conflicts.length })] : undefined,
        });
        return;
      }
      setFeedback({ ok: false, message: data?.error && t.has(`dhis2.rma3.errors.${data.error}`) ? errorText(data.error) : data?.error || t("dhis2.rma3.push_failed") });
    } catch {
      setFeedback({ ok: false, message: t("dhis2.rma3.push_failed") });
    } finally {
      setBusy(null);
      onSent?.();
    }
  };

  const clearMappings = async () => {
    if (!(await confirm({ message: t("dhis2.rma3.clear_confirm"), description: t("dhis2.rma3.clear_confirm_desc"), tone: "danger" }))) return;
    setBusy("clear");
    setFeedback(null);
    try {
      const res = await fetch(`${API}/mappings`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      setFeedback(res.ok ? { ok: true, message: t("dhis2.rma3.cleared", { removed: data.removed }) } : { ok: false, message: errorText(data?.error) });
      if (res.ok) await load();
    } catch {
      setFeedback({ ok: false, message: t("dhis2.rma3.errors.export_failed") });
    } finally {
      setBusy(null);
    }
  };

  const canExport = Boolean(summary?.target?.orgUnitId && summary.toSend > 0);
  const canPush = canExport && Boolean(summary?.target?.dataSetId) && hasPassword;
  const isBusy = busy !== null;

  return (
    <div className="bg-white rounded-2xl md:rounded border border-slate-200 shadow-sm p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0 max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900">{t("dhis2.rma3.title")}</h3>
          <p className="text-xs text-slate-500">{t("dhis2.rma3.desc")}</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t("dhis2.rma3.period")}</label>
            <Input
              type="month"
              value={toInputValue(period)}
              onChange={(e) => e.target.value && setPeriod(e.target.value.replace("-", ""))}
              className="text-sm h-9 bg-white w-40"
            />
          </div>
          <Button variant="outline" className="h-9 text-xs" onClick={() => void load()} disabled={isLoading || isBusy} aria-label={t("dhis2.rma3.refresh")}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {summary && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={summary.manualStatus === "validated" ? "default" : "outline"}>
              {summary.manualStatus === "validated" ? t("dhis2.rma3.form_validated") : t("dhis2.rma3.form_open")}
            </Badge>
            <Badge variant="outline">{t("dhis2.rma3.mappings_count", { count: summary.mappingsCount })}</Badge>
          </div>

          <dl className="grid grid-cols-2 @3xl:grid-cols-4 gap-3">
            {[
              [t("dhis2.rma3.stat_values"), summary.values],
              [t("dhis2.rma3.stat_to_send"), summary.toSend],
              [t("dhis2.rma3.stat_unmapped"), summary.unmappedCount],
              [t("dhis2.rma3.stat_dictionary"), `${summary.dictionary.produced} / ${summary.dictionary.total}`],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded border border-slate-200 p-3">
                <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</dt>
                <dd className="text-lg font-bold text-slate-900 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {summary.collisions.length > 0 && (
            <p className="text-xs text-amber-700">
              {t("dhis2.rma3.stat_collisions")} : {summary.collisions.length} ({summary.collisions[0].first} ↔ {summary.collisions[0].second})
            </p>
          )}
          {!summary.target?.orgUnitId && <p className="text-xs text-amber-700">{t("dhis2.rma3.no_target")}</p>}

          <section className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900">{t("dhis2.rma3.section_file")}</h4>
            <p className="text-xs text-slate-500">{t("dhis2.rma3.section_file_desc")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="text-xs h-8" disabled={!canExport || isBusy} onClick={() => void download(`${API}/export?period=${period}&format=json`, `rma3-dhis2-${period}.json`)}>
                <Download className="h-3 w-3 mr-2" />
                {t("dhis2.rma3.download_json")}
              </Button>
              <Button variant="outline" className="text-xs h-8" disabled={!canExport || isBusy} onClick={() => void download(`${API}/export?period=${period}&format=csv`, `rma3-dhis2-${period}.csv`)}>
                <Download className="h-3 w-3 mr-2" />
                {t("dhis2.rma3.download_csv")}
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900">{t("dhis2.rma3.section_mapping")}</h4>
            <p className="text-xs text-slate-500">{t("dhis2.rma3.section_mapping_desc")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="text-xs h-8" disabled={isBusy} onClick={() => void download(`${API}/mapping-template?period=${period}`, "rma3-dhis2-mapping.csv")}>
                <Download className="h-3 w-3 mr-2" />
                {t("dhis2.rma3.download_template")}
              </Button>
              <Button variant="outline" className="text-xs h-8" disabled={isBusy} onClick={() => fileInput.current?.click()}>
                {busy === "import" ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <FileUp className="h-3 w-3 mr-2" />}
                {busy === "import" ? t("dhis2.rma3.importing") : t("dhis2.rma3.import_csv")}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importMapping(file);
                }}
              />
              <Button variant="outline" className="text-xs h-8" disabled={!hasPassword || !summary.target?.dataSetId || isBusy} onClick={() => void propose(false)}>
                {busy === "propose" ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
                {busy === "propose" ? t("dhis2.rma3.proposing") : t("dhis2.rma3.propose")}
              </Button>
              {pendingProposals > 0 && (
                <Button className="text-xs h-8" disabled={isBusy} onClick={() => void propose(true)}>
                  <CheckCircle2 className="h-3 w-3 mr-2" />
                  {t("dhis2.rma3.propose_apply")}
                </Button>
              )}
              {summary.mappingsCount > 0 && (
                <Button variant="outline" className="text-xs h-8 text-red-600" disabled={isBusy} onClick={() => void clearMappings()}>
                  <Trash2 className="h-3 w-3 mr-2" />
                  {t("dhis2.rma3.clear")}
                </Button>
              )}
            </div>
            {summary.unmapped.length > 0 && (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer">{t("dhis2.rma3.unmapped_title")}</summary>
                <ul className="mt-2 max-h-48 overflow-y-auto space-y-0.5 font-mono text-[11px]">
                  {summary.unmapped.map((u) => (
                    <li key={`${u.indicatorCode}|${u.tableKey}|${u.cellKey}`}>
                      {u.indicatorCode}
                      {u.cellKey ? ` / ${u.cellKey}` : ""} — {u.label}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900">{t("dhis2.rma3.section_push")}</h4>
            <p className="text-xs text-slate-500">{t("dhis2.rma3.section_push_desc")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="text-xs h-8" disabled={!canPush || isBusy} onClick={() => void push(true)}>
                {t("dhis2.rma3.dry_run")}
              </Button>
              <Button className="text-xs h-8" disabled={!canPush || isBusy || summary.manualStatus !== "validated"} onClick={() => void push(false)}>
                {busy === "push" ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Send className="h-3 w-3 mr-2" />}
                {busy === "push" ? t("dhis2.rma3.pushing") : t("dhis2.rma3.push")}
              </Button>
            </div>
          </section>
        </>
      )}

      {isLoading && !summary && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      )}

      {feedback && (
        <div className={`text-xs space-y-1 ${feedback.ok ? "text-green-700" : "text-red-600"}`} role="status">
          <div className="flex items-start gap-2">
            {feedback.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          {feedback.details && (
            <ul className="ml-6 max-h-40 overflow-y-auto font-mono text-[11px] list-disc">
              {feedback.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
