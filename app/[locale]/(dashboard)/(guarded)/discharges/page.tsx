"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileText, Loader2, LogOut, Search } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";
import { usePdfBranding } from "@/components/templates/usePdfBranding";
import type { MedicalRecordData } from "@/components/templates/MedicalRecordTemplate";
import { hospitalizedDays } from "@/lib/billing/hospitalizedDays";
import { DischargeSheet } from "../stays/[id]/_components/DischargeSheet";
import { buildMedicalRecord } from "../stays/[id]/_components/buildMedicalRecord";
import type { StayDetail } from "../stays/[id]/types";

type View = "pending" | "done";

type DischargeRow = {
  id: string;
  stayNumber: string;
  status: string;
  hospitalizedAt: string | null;
  dischargeDate: string | null;
  patient: { id: string; firstName: string; lastName: string; ipp: string };
  departmentName: string | null;
  bedLabel: string | null;
  roomLabel: string | null;
  billing: { invoiceId: string; outstanding: number; refundDue: number } | null;
};

type Loaded = { key: string; rows: DischargeRow[]; total: number } | { key: string; error: true };

const fmt = (date: string | null) => (date ? format(new Date(date), "dd/MM/yyyy HH:mm") : "—");

// Hospitalised patients whose deposit is settled ("Hospitalisés"), whom the doctor can
// discharge here; and past discharges ("Sortis"). Discharging regularises the hospitalisation
// bill server-side and opens the discharge record (medical record with the discharge mention).
export default function DischargesPage() {
  const t = useTranslations("discharges");
  const ta = useTranslations("admissions");
  const tm = useTranslations("documents.medicalRecord");
  const tc = useTranslations("common");
  const hasModule = useAppStore((state) => state.hasModule);
  const { facility: pdfFacility, settings: pdfSettings } = usePdfBranding();

  const [view, setView] = useState<View>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const [dischargeTarget, setDischargeTarget] = useState<DischargeRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recordPdf, setRecordPdf] = useState<{ data: MedicalRecordData; fileName: string } | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryKey = JSON.stringify([view, search, page, pageSize, refreshToken]);
  const canAccess = hasModule("MODULE_ADMISSION");

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    const params = new URLSearchParams({ view, page: String(page), limit: String(pageSize) });
    if (search) params.set("q", search);
    fetch(`/api/v1/discharges?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? "load failed");
        if (!cancelled) setLoaded({ key: queryKey, rows: json.data, total: json.total });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: queryKey, error: true });
      });
    return () => {
      cancelled = true;
    };
    // queryKey already encodes every input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, canAccess]);

  if (!canAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{tc("restricted_access")}</h2>
          <p className="mt-2 text-sm text-slate-500">{t("description")}</p>
          <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">{tc("contact_admin")}</p>
        </div>
      </div>
    );
  }

  const isLoading = !loaded || loaded.key !== queryKey;
  const hasError = !isLoading && "error" in loaded;
  const rows = !isLoading && "rows" in loaded ? loaded.rows : [];
  const total = !isLoading && "rows" in loaded ? loaded.total : 0;

  const switchView = (next: View) => {
    setView(next);
    setPage(1);
  };

  // Always re-fetched, so the record reflects the discharge just saved and every result
  // validated since.
  const openDischargeRecord = async (stayId: string) => {
    try {
      const res = await fetch(`/api/v1/stays/${stayId}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t("load_error"));
      const stay = json.data as StayDetail;
      setRecordPdf({ data: buildMedicalRecord(stay, ta, tm), fileName: `fiche-sortie-${stay.stayNumber}` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("load_error"));
    }
  };

  const handleDischarge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!dischargeTarget) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/v1/stays/${dischargeTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "discharged",
          dischargeDate: new Date(formData.get("dischargeDate") as string).toISOString(),
          dischargeSummary: formData.get("dischargeSummary"),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? ta("error_save"));
      toast.success(t("discharged_toast"));
      if (json.billing?.actualDays) toast.info(t("regularized_toast", { days: json.billing.actualDays }));
      const stayId = dischargeTarget.id;
      setDischargeTarget(null);
      setRefreshToken((value) => value + 1);
      await openDischargeRecord(stayId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta("error_save"));
    } finally {
      setSubmitting(false);
    }
  };

  const location = (row: DischargeRow) => [row.departmentName, row.roomLabel, row.bedLabel].filter(Boolean).join(" · ") || "—";
  const duration = (row: DischargeRow) =>
    row.hospitalizedAt
      ? t("days_count", { days: hospitalizedDays(new Date(row.hospitalizedAt), row.dischargeDate ? new Date(row.dischargeDate) : new Date()) })
      : "—";
  const billingBadge = (row: DischargeRow) => {
    if (!row.billing) return <span className="text-slate-400">{t("billing_none")}</span>;
    if (row.billing.outstanding > 0) {
      return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">{t("billing_outstanding", { amount: row.billing.outstanding.toLocaleString() })}</span>;
    }
    if (row.billing.refundDue > 0) {
      return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">{t("billing_refund", { amount: row.billing.refundDue.toLocaleString() })}</span>;
    }
    return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">{t("billing_settled")}</span>;
  };
  const actions = (row: DischargeRow) => (
    <div className="flex flex-wrap gap-2 md:justify-end">
      {view === "pending" ? (
        <Button size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => setDischargeTarget(row)}>
          <LogOut className="h-3.5 w-3.5 mr-1.5" /> {t("discharge")}
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDischargeRecord(row.id)}>
          <FileText className="h-3.5 w-3.5 mr-1.5" /> {t("print_discharge_record")}
        </Button>
      )}
      <Link href={`/stays/${row.id}`} className="inline-flex items-center h-8 px-2 text-xs font-medium text-blue-600 hover:underline">
        {t("open_record")}
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
        <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-fit">
          {(["pending", "done"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchView(option)}
              className={cn(
                "px-3 h-8 rounded-md text-xs font-medium transition-colors",
                view === option ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {option === "pending" ? t("tab_pending") : t("tab_done")}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("search_placeholder")}
            className="h-9 pl-8 text-xs bg-white"
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : hasError ? (
          <div className="text-center py-10 text-xs text-red-600">{t("load_error")}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 italic">{view === "pending" ? t("no_pending") : t("no_done")}</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block flex-1 overflow-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0">
                    <th className="px-4 py-2">{t("col_patient")}</th>
                    <th className="px-4 py-2">{t("col_location")}</th>
                    <th className="px-4 py-2">{t("col_hospitalized_at")}</th>
                    {view === "done" && <th className="px-4 py-2">{t("col_discharged_at")}</th>}
                    <th className="px-4 py-2">{t("col_duration")}</th>
                    <th className="px-4 py-2">{t("col_billing")}</th>
                    <th className="px-4 py-2 text-right">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.patient.lastName} {row.patient.firstName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">IPP {row.patient.ipp} · {row.stayNumber}</div>
                        {view === "done" && row.status !== "discharged" && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{tc(`status_${row.status}`)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{location(row)}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{fmt(row.hospitalizedAt)}</td>
                      {view === "done" && <td className="px-4 py-3 font-mono text-slate-600">{fmt(row.dischargeDate)}</td>}
                      <td className="px-4 py-3 text-slate-700">{duration(row)}</td>
                      <td className="px-4 py-3 text-[11px]">{billingBadge(row)}</td>
                      <td className="px-4 py-3">{actions(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {rows.map((row) => (
                <div key={row.id} className="p-3 space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-900">{row.patient.lastName} {row.patient.firstName}</div>
                  <div className="text-[10px] text-slate-400 font-mono">IPP {row.patient.ipp} · {row.stayNumber}</div>
                  <div className="text-slate-700">{location(row)}</div>
                  <div className="text-slate-500">
                    {t("col_hospitalized_at")} {fmt(row.hospitalizedAt)} · {duration(row)}
                    {view === "done" && <> · {t("col_discharged_at")} {fmt(row.dischargeDate)}</>}
                  </div>
                  <div className="text-[11px]">{billingBadge(row)}</div>
                  {actions(row)}
                </div>
              ))}
            </div>
          </>
        )}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <DischargeSheet
        open={Boolean(dischargeTarget)}
        onOpenChange={(open) => !open && setDischargeTarget(null)}
        submitting={submitting}
        onSubmit={handleDischarge}
      />

      <PDFPreviewModal
        isOpen={Boolean(recordPdf)}
        onClose={() => setRecordPdf(null)}
        templateId="medical_record"
        data={recordPdf?.data}
        fileName={recordPdf?.fileName}
        facility={pdfFacility}
        settings={pdfSettings}
      />
    </div>
  );
}
