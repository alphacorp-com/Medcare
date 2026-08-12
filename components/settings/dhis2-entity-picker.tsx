"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Dhis2LookupType = "orgUnits" | "dataSets" | "dataElements";

interface Dhis2Entity {
  id: string;
  name: string;
}

// Debounced name search against a tenant's saved DHIS2 connection, scoped to one metadata
// type. Mirrors components/shared/patient-search-autocomplete.tsx (same interaction model:
// input + dropdown + click-outside-to-close) generalized to DHIS2 org units/data sets/data
// elements instead of patients.
export function Dhis2EntityPicker({
  type,
  dataSetId,
  currentId,
  onSelect,
  placeholder,
  className = "",
}: {
  type: Dhis2LookupType;
  dataSetId?: string;
  currentId?: string;
  onSelect: (entity: Dhis2Entity | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const t = useTranslations("settings");

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Dhis2Entity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Dhis2Entity | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) return;
    if (selected && selected.name === query) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setIsOpen(true);
      setError(null);
      try {
        const url = new URL("/api/v1/settings/dhis2/lookup", window.location.origin);
        url.searchParams.set("type", type);
        url.searchParams.set("query", query.trim());
        if (dataSetId) url.searchParams.set("dataSetId", dataSetId);

        const res = await fetch(url.toString(), { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) {
          setResults([]);
          setError(json?.error ?? t("dhis2.lookup_failed"));
          return;
        }
        setResults(json.results ?? []);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selected, type, dataSetId]);

  const handleSelect = (entity: Dhis2Entity) => {
    setSelected(entity);
    setQuery(entity.name);
    setIsOpen(false);
    onSelect(entity);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    onSelect(null);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <Search className={cn("absolute left-2.5 top-2.5 h-3.5 w-3.5", selected ? "text-green-600" : "text-slate-400")} />
        <Input
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            if (!value.trim()) {
              setResults([]);
              setIsOpen(false);
              setIsLoading(false);
            }
            if (selected) {
              setSelected(null);
              onSelect(null);
            }
          }}
          placeholder={placeholder ?? t("dhis2.lookup_placeholder")}
          className={cn(
            "pl-8 pr-8 h-9 text-xs font-mono",
            selected ? "border-green-400 bg-green-50/30 text-green-900 focus-visible:ring-green-400" : "bg-white",
            className
          )}
          onFocus={() => {
            if (query && !selected) setIsOpen(true);
          }}
        />
        {(selected || query) && (
          <button type="button" onClick={handleClear} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {currentId && !selected && !query && (
        <p className="text-[10px] text-slate-400 font-mono mt-1">{t("dhis2.current_id")}: {currentId}</p>
      )}

      {isOpen && query && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center text-slate-500 text-xs">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("dhis2.searching")}
            </div>
          ) : error ? (
            <div className="p-4 text-center text-xs text-red-600">{error}</div>
          ) : results.length > 0 ? (
            <ul className="py-1">
              {results.map((entity) => (
                <li
                  key={entity.id}
                  className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                  onClick={() => handleSelect(entity)}
                >
                  <div className="text-xs font-semibold text-slate-900">{entity.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{entity.id}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-xs text-slate-500">{t("dhis2.no_results")}</div>
          )}
        </div>
      )}
    </div>
  );
}
