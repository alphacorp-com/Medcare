"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, CheckCircle2, XCircle } from "lucide-react";

type ImportResult = {
  imported: number;
  errors: { row: number; message: string }[];
};

// Generic CSV/Excel-exported-CSV importer for the "high-volume" reference-data catalogs
// (ICD-10, pharmaceutical units, medical acts). Parses client-side with PapaParse
// (header row required), previews the first rows, then posts the full parsed row set to
// `importUrl` in one batch — the server validates row-by-row and reports which ones
// failed without blocking the valid ones.
export function CsvImportDialog({
  open,
  onOpenChange,
  importUrl,
  expectedColumns,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importUrl: string;
  expectedColumns: string[];
  onImported: () => void;
}) {
  const t = useTranslations("settings.csvImport");

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFileName("");
    setRows([]);
    setParseError(null);
    setResult(null);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(results.errors[0].message);
          setRows([]);
          return;
        }
        setRows(results.data);
      },
      error: (err) => setParseError(err.message),
    });
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const res = await fetch(importUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) {
        setParseError(json?.error || t("import_error"));
        return;
      }
      setResult(json as ImportResult);
      onImported();
    } catch {
      setParseError(t("import_error"));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-slate-500">{t("expected_columns")}: <span className="font-mono">{expectedColumns.join(", ")}</span></p>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-lg py-8 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30">
            <Upload className="h-6 w-6 text-slate-400" />
            <span className="text-xs text-slate-600">{fileName || t("choose_file")}</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>

          {parseError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{parseError}</div>}

          {rows.length > 0 && !result && (
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase">
                {t("preview_rows", { count: rows.length })}
              </div>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {Object.keys(rows[0]).map((col) => (
                        <th key={col} className="px-2 py-1 font-mono text-slate-500">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        {Object.keys(rows[0]).map((col) => (
                          <td key={col} className="px-2 py-1 text-slate-700">{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-700">
                <CheckCircle2 className="h-4 w-4" /> {t("import_success", { count: result.imported })}
              </div>
              {result.errors.length > 0 && (
                <div className="border border-red-200 bg-red-50 rounded p-2 max-h-32 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-red-700">
                      <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      {t("row_error", { row: err.row, message: err.message })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("close")}</Button>
          {!result && (
            <Button disabled={isImporting || rows.length === 0} onClick={handleImport} className="bg-blue-600 text-white hover:bg-blue-700">
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("import_button", { count: rows.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
