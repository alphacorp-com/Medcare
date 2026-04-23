"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Check, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_PATIENTS = [
  { id: "PAT-001", ipp: "100000123", nss: "1 80 05 75 123 045 67", firstName: "John", lastName: "Doe", dob: "1980-05-15" },
  { id: "PAT-002", ipp: "100000127", nss: "2 90 04 80 127 045 11", firstName: "Charlie", lastName: "Davis", dob: "1990-04-20" },
  { id: "PAT-003", ipp: "100000125", nss: "2 85 01 75 125 045 22", firstName: "Alice", lastName: "Johnson", dob: "1985-01-10" },
  { id: "PAT-004", ipp: "100000126", nss: "1 75 11 75 126 045 33", firstName: "Bob", lastName: "Brown", dob: "1975-11-25" },
  { id: "PAT-005", ipp: "100000999", nss: "1 95 03 75 999 045 44", firstName: "Jane", lastName: "Smith", dob: "1995-03-05" },
];

export function PatientSearchAutocomplete({ 
  onSelect, 
  placeholder = "Search IPP, NSS, or Name...",
  className = ""
}: { 
  onSelect?: (patient: any) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<typeof MOCK_PATIENTS>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<typeof MOCK_PATIENTS[0] | null>(null);
  
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
    if (!query) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (selectedPatient && (selectedPatient.firstName + " " + selectedPatient.lastName) === query) {
       return;
    }

    setIsLoading(true);
    setIsOpen(true);
    
    const timeoutId = setTimeout(() => {
      const lowerQuery = query.toLowerCase();
      const filtered = MOCK_PATIENTS.filter(p => 
        (p.firstName + " " + p.lastName).toLowerCase().includes(lowerQuery) ||
        p.ipp.includes(lowerQuery) || 
        p.nss.replace(/\s/g, '').includes(lowerQuery.replace(/\s/g, ''))
      );
      setResults(filtered);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, selectedPatient]);

  const handleSelect = (patient: typeof MOCK_PATIENTS[0]) => {
    setSelectedPatient(patient);
    setQuery(`${patient.firstName} ${patient.lastName}`);
    setIsOpen(false);
    if (onSelect) onSelect(patient);
  };

  const handleClear = () => {
    setSelectedPatient(null);
    setQuery("");
    if (onSelect) onSelect(null);
  }

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <Search className={cn("absolute left-2.5 top-2.5 h-3.5 w-3.5", selectedPatient ? "text-green-600" : "text-slate-400")} />
        <Input 
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedPatient) {
               setSelectedPatient(null);
               if (onSelect) onSelect(null);
            }
          }}
          placeholder={placeholder} 
          className={cn(
             "pl-8 pr-8", 
             selectedPatient ? "border-green-400 bg-green-50/30 text-green-900 focus-visible:ring-green-400" : "bg-white border-slate-200 focus:border-blue-400",
             className
          )} 
          onFocus={() => {
             if (query && !selectedPatient) setIsOpen(true)
          }}
        />
        {selectedPatient ? (
           <button onClick={handleClear} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
             <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
           </button>
        ) : query ? (
           <button onClick={handleClear} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
             <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
           </button>
        ) : null}
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
                    <div className="text-xs font-bold text-slate-900">{patient.firstName} {patient.lastName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">IPP: {patient.ipp} • NSS: {patient.nss}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center">
               <p className="text-xs font-medium text-slate-900">No patient found</p>
               <p className="text-[10px] text-slate-500 mt-1">Please try another IPP, NSS, or name.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
