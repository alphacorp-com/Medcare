"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsPageHeader } from "@/components/settings/settings-ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { codeMatchesItems, findRubricForCode, normalizeIcd10Code, parseIcd10Ranges } from "@/lib/diagnoses/icd10-ranges";
import { RMA3_RUBRIC_SECTIONS, type Rma3RubricSection } from "@/lib/reports/rma3-rubrics-default";
import { rma3FormSection } from "@/lib/reports/rma3-morbidity-default";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/providers/confirm-provider";

interface Rubric {
  id: string;
  section: Rma3RubricSection;
  code: string;
  label: string;
  icd10Ranges: string;
  order: number;
  isActive: boolean;
}

interface RubricsResponse {
  data: Rubric[];
  overlaps: Record<string, Array<{ category: string; rubrics: string[] }>>;
}

const SECTIONS = RMA3_RUBRIC_SECTIONS;
const QUERY_KEY = ["settings", "rma3-rubrics"];

type Draft = Pick<Rubric, "label" | "icd10Ranges" | "isActive">;

// Settings > RMA3 : correspondance CIM-10. The administrator reviews and adjusts which
// ICD-10 codes feed each rubric of the RMA3 tables: causes V.3 / V.4 / V.5 (one rubric per
// diagnosis) and the morbidity sections II.2 to IV.5 (every matching rubric). Changes are
// validated and audited by the API; this page also previews where a code would be counted.
export default function Rma3MappingPage() {
  const t = useTranslations("settings.rma3Mapping");
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Rma3RubricSection>("V.3");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [testCode, setTestCode] = useState("");

  const query = useQuery({ queryKey: QUERY_KEY, queryFn: () => apiFetch<RubricsResponse>("/api/v1/settings/rma3-rubrics") });
  const rubrics = query.data?.data ?? [];
  const sectionRubrics = rubrics.filter((r) => r.section === section).sort((a, b) => a.order - b.order);
  const exclusive = SECTIONS.find((s) => s.section === section)?.exclusive ?? true;
  // Overlaps only matter where a diagnosis is counted once (V.3-V.5).
  const overlaps = exclusive ? query.data?.overlaps?.[section] ?? [] : [];

  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Draft> | { reset: true } }) =>
      apiFetch<{ data: Rubric }>(`/api/v1/settings/rma3-rubrics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (_, { id }) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success(t("saved"));
      return queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => toast.error(error instanceof ApiError && error.status === 400 ? t("invalid") : t("save_error")),
  });

  const draftOf = (r: Rubric): Draft => drafts[r.id] ?? { label: r.label, icd10Ranges: r.icd10Ranges, isActive: r.isActive };
  const setDraft = (r: Rubric, patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [r.id]: { ...draftOf(r), ...patch } }));
  const isDirty = (r: Rubric) => {
    const d = drafts[r.id];
    return Boolean(d && (d.label !== r.label || d.icd10Ranges !== r.icd10Ranges || d.isActive !== r.isActive));
  };

  const normalizedTest = normalizeIcd10Code(testCode);
  const labelByCode = new Map(rubrics.map((r) => [r.code, r.label]));

  return (
    <div className="space-y-4">
      <SettingsPageHeader title={t("title")} description={t("description")} />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{t("medical_review_notice")}</div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <label className="space-y-1">
          <span className="block text-xs font-semibold text-slate-600">{t("test_code")}</span>
          <Input value={testCode} onChange={(e) => setTestCode(e.target.value)} placeholder="B50.9" className="h-9 w-32 font-mono" />
        </label>
        {testCode.trim() && (
          <div className="flex flex-wrap gap-2 text-xs">
            {!normalizedTest ? (
              <span className="text-red-600">{t("test_invalid")}</span>
            ) : (
              SECTIONS.map(({ section: s, exclusive: isExclusive }) => {
                const candidates = rubrics.filter((r) => r.section === s);
                const matches = isExclusive
                  ? [findRubricForCode(normalizedTest, candidates)].filter((r): r is Rubric => r !== null)
                  : candidates.filter((r) => {
                      const parsed = parseIcd10Ranges(r.icd10Ranges);
                      return r.isActive && parsed.ok && codeMatchesItems(normalizedTest, parsed.items);
                    });
                // Morbidity sections without a match are noise: only cause tables show "unclassified".
                if (!isExclusive && matches.length === 0) return null;
                return (
                  <span key={s} className={cn("rounded-full px-2.5 py-1", matches.length ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-500")}>
                    <strong>{rma3FormSection(s)}</strong> : {matches.length ? matches.map((r) => r.label).join(" / ") : t("test_unclassified")}
                  </span>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-0.5 rounded-md bg-slate-100 p-0.5" role="tablist">
        {SECTIONS.map(({ section: s, title }) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={section === s}
            onClick={() => setSection(s)}
            className={cn("rounded px-3 py-1.5 text-xs font-semibold", section === s ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            {rma3FormSection(s)} — {title}
          </button>
        ))}
      </div>

      {!exclusive && <p className="text-xs text-slate-500">{t("morbidity_hint")}</p>}

      {overlaps.length > 0 && (
        <div role="alert" className="flex gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{t("overlaps_title", { count: overlaps.length })}</p>
            <p>
              {overlaps
                .slice(0, 8)
                .map((o) => `${o.category} (${o.rubrics.map((c) => labelByCode.get(c) ?? c).join(" / ")})`)
                .join(" · ")}
              {overlaps.length > 8 ? " …" : ""}
            </p>
            <p className="mt-1">{t("overlaps_hint")}</p>
          </div>
        </div>
      )}

      {query.isPending ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : query.isError ? (
        <p className="text-sm text-red-600">{t("load_error")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[44rem] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 w-14">{t("col_code")}</th>
                <th className="px-3 py-2">{t("col_label")}</th>
                <th className="px-3 py-2 w-64">{t("col_ranges")}</th>
                <th className="px-3 py-2 w-20 text-center">{t("col_active")}</th>
                <th className="px-3 py-2 w-40 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sectionRubrics.map((r) => {
                const d = draftOf(r);
                const rangesValid = parseIcd10Ranges(d.icd10Ranges).ok;
                const saving = mutation.isPending && mutation.variables?.id === r.id;
                return (
                  <tr key={r.id} className={cn(!d.isActive && "bg-slate-50 text-slate-400")}>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{r.code.replace(`RMA3-${r.section}-`, "")}</td>
                    <td className="px-3 py-2">
                      <Input value={d.label} maxLength={255} onChange={(e) => setDraft(r, { label: e.target.value })} className="h-8 text-xs" />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={d.icd10Ranges}
                        onChange={(e) => setDraft(r, { icd10Ranges: e.target.value })}
                        aria-invalid={!rangesValid || undefined}
                        placeholder="B50-B54, A39"
                        className={cn("h-8 font-mono text-xs", !rangesValid && "border-red-300")}
                      />
                      {!rangesValid && <p className="mt-0.5 text-[10px] text-red-600">{t("ranges_invalid")}</p>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={d.isActive} onChange={(e) => setDraft(r, { isActive: e.target.checked })} aria-label={t("col_active")} className="rounded border-slate-300" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 bg-blue-600 px-2 text-[11px] text-white hover:bg-blue-700"
                          disabled={!isDirty(r) || !rangesValid || saving}
                          onClick={() => mutation.mutate({ id: r.id, body: d })}
                        >
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          <span className="ml-1">{t("save")}</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          title={t("reset_hint")}
                          disabled={saving}
                          onClick={async () => {
                            if ((await confirm({ message: t("reset_confirm", { label: r.label }), tone: "danger" }))) mutation.mutate({ id: r.id, body: { reset: true } });
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
