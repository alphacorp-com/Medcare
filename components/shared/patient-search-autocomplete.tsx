"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  ipp: string;
  nss?: string | null;
  firstName: string;
  lastName: string;
}

export function PatientSearchAutocomplete({
  onSelect,
  placeholder = "Search IPP, NSS, or Name...",
  className = "",
}: {
  onSelect?: (patient: Patient | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

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
    if (!query.trim()) {
      return;
    }

    if (selectedPatient && `${selectedPatient.firstName} ${selectedPatient.lastName}` === query) {
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setIsOpen(true);

      try {
        const q = query.trim();
        const url = new URL("/api/v1/patients", window.location.origin);
        url.searchParams.set("q", q);
        url.searchParams.set("limit", "10");

        const res = await fetch(url.toString(), { signal: controller.signal });
        const json = await res.json();

        if (!res.ok || !json.success) {
          setResults([]);
          return;
        }

        setResults(json.data ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, selectedPatient]);

  const handleSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setQuery(`${patient.firstName} ${patient.lastName}`);
    setIsOpen(false);
    onSelect?.(patient);
  };

  const handleClear = () => {
    setSelectedPatient(null);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    onSelect?.(null);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <Search
          className={cn(
            "absolute left-2.5 top-2.5 h-3.5 w-3.5",
            selectedPatient ? "text-green-600" : "text-slate-400"
          )}
        />
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

            if (selectedPatient) {
              setSelectedPatient(null);
              onSelect?.(null);
            }
          }}
          placeholder={placeholder}
          className={cn(
            "pl-8 pr-8",
            selectedPatient
              ? "border-green-400 bg-green-50/30 text-green-900 focus-visible:ring-green-400"
              : "bg-white border-slate-200 focus:border-blue-400",
            className
          )}
          onFocus={() => {
            if (query && !selectedPatient) setIsOpen(true);
          }}
        />
        {(selectedPatient || query) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && query && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center text-slate-500 text-xs">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching...
            </div>
          ) : results.length > 0 ? (
            <ul className="py-1">
              {results.map((patient) => (
                <li
                  key={patient.id}
                  className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0"
                  onClick={() => handleSelect(patient)}
                >
                  <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {patient.firstName} {patient.lastName}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      IPP: {patient.ipp}
                      {patient.nss ? ` • NSS: ${patient.nss}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center">
              <p className="text-xs font-medium text-slate-900">No patient found</p>
              <p className="text-[10px] text-slate-500 mt-1">
                Please try another IPP, NSS, or name.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
