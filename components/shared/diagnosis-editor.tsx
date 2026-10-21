"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

// Coded diagnoses (ICD-10) entry, shared by the consultation and the discharge. The server
// re-validates every code against the tenant's catalog and takes the label from there.

export interface Icd10Option {
  code: string;
  labelFr: string;
  chapter?: string | null;
}

export interface DiagnosisDraft {
  code: string;
  label: string;
  kind: "principal" | "secondary";
  isNewCase: boolean;
}

// What the API expects (labels are resolved server-side).
export function toDiagnosisPayload(drafts: DiagnosisDraft[]) {
  return drafts.map(({ code, kind, isNewCase }) => ({ code, kind, isNewCase }));
}

const DIAGNOSIS_ERROR_CODES = [
  "principal_required",
  "cause_of_death_required",
  "single_principal",
  "duplicate_code",
  "invalid_code",
  "unknown_code",
  "too_many",
  "not_a_list",
  "invalid_entry",
] as const;

// Translates the error code returned with a 400 by the routes that record diagnoses
// (records, stay discharge). Returns null for other errors so callers keep their message.
export function useDiagnosisErrorMessage() {
  const t = useTranslations("diagnoses.errors");
  return (body: unknown): string | null => {
    if (!body || typeof body !== "object") return null;
    const { code, codes } = body as { code?: unknown; codes?: unknown };
    if (typeof code !== "string" || !(DIAGNOSIS_ERROR_CODES as readonly string[]).includes(code)) return null;
    const list = Array.isArray(codes) ? codes.filter((c): c is string => typeof c === "string").join(", ") : "";
    return t(code, { codes: list });
  };
}

export function Icd10Search({
  onSelect,
  excludeCodes = [],
  placeholder,
  invalid,
}: {
  onSelect: (option: Icd10Option) => void;
  excludeCodes?: string[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const t = useTranslations("diagnoses");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const search = useDebouncedValue(query.trim(), 250);

  const results = useQuery({
    queryKey: ["icd10-search", search],
    queryFn: () => apiFetch<{ data: Icd10Option[] }>(`/api/v1/icd10?search=${encodeURIComponent(search)}`),
    enabled: search.length >= 2,
    staleTime: 5 * 60_000,
  });
  const options = (results.data?.data ?? []).filter((o) => !excludeCodes.includes(o.code));
  const showList = open && search.length >= 2;

  const choose = (option: Icd10Option) => {
    onSelect(option);
    setQuery("");
    setOpen(false);
    setActive(0);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        value={query}
        placeholder={placeholder ?? t("search_placeholder")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList || options.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault(); // never submit the surrounding form
            choose(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn("pl-8", invalid && "border-red-300 focus-visible:ring-red-300")}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {results.isFetching && options.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("searching")}
            </li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">{t("no_result")}</li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.code}
                role="option"
                aria-selected={index === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn("flex cursor-pointer gap-2 px-3 py-1.5", index === active ? "bg-blue-50" : "hover:bg-slate-50")}
              >
                <span className="w-14 shrink-0 font-mono text-xs font-semibold text-blue-700">{option.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-slate-800">{option.labelFr}</span>
                  {option.chapter && <span className="block truncate text-[11px] text-slate-400">{option.chapter}</span>}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function DiagnosisChip({ draft, onRemove, onToggleNew, disabled }: { draft: DiagnosisDraft; onRemove: () => void; onToggleNew: () => void; disabled?: boolean }) {
  const t = useTranslations("diagnoses");
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
      <span className="font-mono text-xs font-semibold text-blue-700">{draft.code}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800" title={draft.label}>{draft.label}</span>
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" checked={draft.isNewCase} onChange={onToggleNew} disabled={disabled} className="rounded border-slate-300" />
        {t("new_case")}
      </label>
      {!disabled && (
        <button type="button" onClick={onRemove} aria-label={t("remove")} className="rounded p-0.5 text-slate-400 hover:text-red-600">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// One principal diagnosis (required when `required`) plus optional secondary diagnoses.
export function DiagnosisEditor({
  value,
  onChange,
  required,
  disabled,
  principalLabel,
}: {
  value: DiagnosisDraft[];
  onChange: (next: DiagnosisDraft[]) => void;
  required?: boolean;
  disabled?: boolean;
  principalLabel?: string;
}) {
  const t = useTranslations("diagnoses");
  const [addingSecondary, setAddingSecondary] = useState(false);
  const principal = value.find((d) => d.kind === "principal");
  const secondaries = value.filter((d) => d.kind === "secondary");
  const codes = value.map((d) => d.code);

  const add = (option: Icd10Option, kind: DiagnosisDraft["kind"]) =>
    onChange([...value, { code: option.code, label: option.labelFr, kind, isNewCase: true }]);
  const update = (code: string, patch: Partial<DiagnosisDraft>) => onChange(value.map((d) => (d.code === code ? { ...d, ...patch } : d)));
  const remove = (code: string) => onChange(value.filter((d) => d.code !== code));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-600">
          {principalLabel ?? t("principal")} {required && <span className="text-red-600">*</span>}
        </p>
        {principal ? (
          <DiagnosisChip draft={principal} disabled={disabled} onRemove={() => remove(principal.code)} onToggleNew={() => update(principal.code, { isNewCase: !principal.isNewCase })} />
        ) : (
          !disabled && <Icd10Search onSelect={(o) => add(o, "principal")} excludeCodes={codes} invalid={required} />
        )}
        {required && !principal && <p className="text-[11px] text-red-600">{t("principal_required")}</p>}
      </div>

      {(secondaries.length > 0 || !disabled) && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-600">{t("secondary")}</p>
          {secondaries.map((d) => (
            <DiagnosisChip key={d.code} draft={d} disabled={disabled} onRemove={() => remove(d.code)} onToggleNew={() => update(d.code, { isNewCase: !d.isNewCase })} />
          ))}
          {!disabled && principal &&
            (addingSecondary ? (
              <Icd10Search
                onSelect={(o) => {
                  add(o, "secondary");
                  setAddingSecondary(false);
                }}
                excludeCodes={codes}
              />
            ) : (
              <button type="button" onClick={() => setAddingSecondary(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                <Plus className="h-3.5 w-3.5" /> {t("add_secondary")}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
