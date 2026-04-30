"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search,
  Receipt,
  FileCheck,
  Banknote,
  FileDigit,
  Code,
  Download,
  X,
  FileText,
  Mail,
  Check,
} from "lucide-react";
import { PDFPreviewModal } from "@/components/templates/PDFPreviewModal";

type BillingRecord = {
  id: string;
  stayId: string;
  stayNumber: string;
  patientName: string;
  ipp: string;
  status: string;
  amount: number;
  pmsiCode: string | null;
  dischargeDate: string;
  lineItems: any[];
};

const statusLabelMap: Record<string, string> = {
  open: "To Code",
  coded: "To Validate (DIM)",
  validated: "Ready to Bill",
  billed: "Billed",
  paid: "Paid",
};

export default function BillingPage() {
  const t = useTranslations("billing");
  const tc = useTranslations("common");
  const hasModule = useAppStore((state) => state.hasModule);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [billingStays, setBillingStays] = useState<BillingRecord[]>([]);
  const [selectedDossier, setSelectedDossier] = useState<BillingRecord | null>(null);
  const [isCodingModalOpen, setIsCodingModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingStays = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/billing", { signal });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load billing records");
      }
      setBillingStays(json.data);
    } catch (e) {
      if ((e as any)?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadBillingStays = async () => {
      await fetchBillingStays(controller.signal);
    };

    void loadBillingStays();
    return () => controller.abort();
  }, []);

  const getStatusText = (status: string) => {
    switch (status) {
      case "open":
        return t("to_code");
      case "coded":
        return t("dim_validation");
      case "validated":
        return t("ready_to_bill");
      case "billed":
        return t("invoices_generated");
      case "paid":
        return tc("status_paid");
      default:
        return statusLabelMap[status] ?? status;
    }
  };

  const buildInvoicePreview = (record: BillingRecord) => {
    const items = Array.isArray(record.lineItems) && record.lineItems.length > 0
      ? record.lineItems.map((item: any) => ({
          description: item.description || item.name || item.label || "Charge",
          quantity: item.quantity ?? item.qty ?? 1,
          amount: Number(item.amount ?? item.total ?? item.unitPrice ?? 0) || 0,
        }))
      : [{ description: "Billing Total", quantity: 1, amount: record.amount }];

    return {
      invoice: {
        number: record.id,
        date: format(new Date(record.dischargeDate), "yyyy-MM-dd"),
        patientName: record.patientName,
        patientIpp: record.ipp,
        status: getStatusText(record.status),
        items,
        subtotal: record.amount,
        total: record.amount,
      }
    };
  };

  const handleExportInvoice = () => {
    const record = selectedDossier || billingStays[0];
    if (!record) {
      setError("No billing record available for export.");
      return;
    }
    setPreviewInvoice(buildInvoicePreview(record));
    setIsPreviewOpen(true);
  };

  const handleStatusUpdate = async (recordId: string, nextStatus: string) => {
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/v1/billing/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update status");
      }
      await fetchBillingStays();
      if (selectedDossier?.id === recordId) {
        setSelectedDossier({ ...selectedDossier, status: nextStatus });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setStatusUpdating(false);
    }
  };

  const statusCounts = {
    open: billingStays.filter((stay) => stay.status === "open").length,
    coded: billingStays.filter((stay) => stay.status === "coded").length,
    validated: billingStays.filter((stay) => stay.status === "validated").length,
    billed: billingStays.filter((stay) => stay.status === "billed").length,
  };

  const filteredStays = billingStays.filter((stay) => {
    if (filter !== "all" && stay.status !== filter) return false;
    if (!search) return true;

    const query = search.toLowerCase();
    return (
      stay.patientName.toLowerCase().includes(query) ||
      stay.stayNumber.toLowerCase().includes(query) ||
      stay.ipp.toLowerCase().includes(query)
    );
  });

  if (!hasModule("MODULE_BILLING")) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{tc("restricted_access")}</h2>
          <p className="mt-2 text-sm text-slate-500">{t("module_desc")}</p>
          <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
            {tc("contact_admin")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportInvoice}>
            <Download className="h-3.5 w-3.5 mr-2" /> {tc("export")}
          </Button>
          <a
            href={`mailto:?subject=Billing Export&body=Please find the attached billing report.`}
            className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
          >
            <Mail className="h-3.5 w-3.5 mr-2" /> Email
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 shrink-0">
        <div
          className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer"
          onClick={() => setFilter("open")}
        >
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t("to_code")}</div>
            <div className="text-3xl font-bold text-slate-900">{statusCounts.open}</div>
          </div>
          <Code className="h-8 w-8 text-slate-200" />
        </div>
        <div
          className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer"
          onClick={() => setFilter("coded")}
        >
          <div>
            <div className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-1">{t("dim_validation")}</div>
            <div className="text-3xl font-bold text-yellow-600">{statusCounts.coded}</div>
          </div>
          <FileCheck className="h-8 w-8 text-yellow-100" />
        </div>
        <div
          className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer"
          onClick={() => setFilter("validated")}
        >
          <div>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">{t("ready_to_bill")}</div>
            <div className="text-3xl font-bold text-green-600">{statusCounts.validated}</div>
          </div>
          <Receipt className="h-8 w-8 text-green-100" />
        </div>
        <div
          className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer"
          onClick={() => setFilter("billed")}
        >
          <div>
            <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">{t("invoices_generated")}</div>
            <div className="text-3xl font-bold text-blue-700">{statusCounts.billed}</div>
          </div>
          <Banknote className="h-8 w-8 text-blue-100" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="relative w-96 flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="search"
              placeholder={tc("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
            />
          </div>
          <div className="flex bg-slate-200/50 p-1 rounded-md ml-4">
            {(["all", "open", "coded", "validated", "billed"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={cn(
                  "px-3 py-1 rounded text-[10px] uppercase font-bold",
                  filter === status ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {status === "all" ? tc("all") : getStatusText(status)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="px-4 py-2">{t("stay_record")}</th>
                <th className="px-4 py-2">{tc("patient")}</th>
                <th className="px-4 py-2">{tc("date")}</th>
                <th className="px-4 py-2">{t("pmsi_code")}</th>
                <th className="px-4 py-2 text-right">{t("amount")}</th>
                <th className="px-4 py-2">{tc("status")}</th>
                <th className="px-4 py-2 text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {filteredStays.map((stay) => (
                <tr key={stay.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => setSelectedDossier(stay)}>
                  <td className="px-4 py-2 font-mono text-slate-600">{stay.stayNumber}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {stay.patientName}
                      <span className="text-[10px] font-mono text-slate-400">({stay.ipp})</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{format(new Date(stay.dischargeDate), "MMM dd, yyyy")}</td>
                  <td className="px-4 py-2 font-mono text-slate-900 font-semibold">{stay.pmsiCode || <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-2 text-right font-mono">{stay.amount > 0 ? `${stay.amount.toFixed(2)}` : "--"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center w-fit",
                        stay.status === "open"
                          ? "bg-slate-100 text-slate-700"
                          : stay.status === "coded"
                          ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                          : stay.status === "validated"
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-blue-100 text-blue-700"
                      )}
                    >
                      {getStatusText(stay.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className={cn(
                        "font-semibold px-3 py-1 rounded text-[11px]",
                        stay.status === "open"
                          ? "bg-slate-800 text-white hover:bg-slate-900"
                          : stay.status === "coded"
                          ? "bg-yellow-500 text-white hover:bg-yellow-600"
                          : stay.status === "validated"
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "text-blue-600 hover:bg-blue-50"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDossier(stay);
                      }}
                    >
                      {stay.status === "open"
                        ? t("enter_codes")
                        : stay.status === "coded"
                        ? t("review_dim")
                        : stay.status === "validated"
                        ? t("generate_invoice")
                        : tc("view")}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStays.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">{tc("no_data")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!selectedDossier} onOpenChange={(open) => !open && setSelectedDossier(null)}>
        {selectedDossier && (
          <SheetContent className="sm:max-w-2xl w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
            <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-lg flex items-center gap-2">
                    {t("billing_record")}
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                        selectedDossier.status === "open"
                          ? "bg-slate-100 text-slate-700"
                          : selectedDossier.status === "coded"
                          ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                          : selectedDossier.status === "validated"
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-blue-100 text-blue-700"
                      )}
                    >
                      {getStatusText(selectedDossier.status)}
                    </span>
                  </SheetTitle>
                  <SheetDescription className="text-xs mt-1">
                    <span className="font-mono">ID: {selectedDossier.id}</span> &bull; {t("stay_record")}: {selectedDossier.stayNumber}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                    {selectedDossier.patientName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{selectedDossier.patientName}</div>
                    <div className="text-[10px] font-mono text-slate-500">IPP: {selectedDossier.ipp}</div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-xs h-7">{tc("view")}</Button>
              </div>

              {selectedDossier.status === "open" && (
                <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-center py-10">
                  <FileDigit className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-800">{t("enter_codes")}</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {t("enter_codes")} pour préparer ce séjour à la validation DIM.
                  </p>
                  <Button className="mt-4 text-xs h-8 bg-slate-900" onClick={() => setIsCodingModalOpen(true)}>
                    {t("enter_codes")}
                  </Button>
                </div>
              )}

              {(selectedDossier.status === "coded" || selectedDossier.status === "validated" || selectedDossier.status === "billed") && (
                <>
                  <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden p-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">PMSI Data Submitted</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Primary Diagnosis Code (DP)</label>
                        <div className="text-lg font-mono font-bold text-slate-800">{selectedDossier.pmsiCode || "—"}</div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Stay ID</label>
                        <div className="text-sm font-semibold text-slate-800">{selectedDossier.stayNumber}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden p-0">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Financial Simulation</div>
                    </div>
                    <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-600">{t("amount")}</span>
                      <span className="text-sm font-mono font-bold text-slate-900">{selectedDossier.amount > 0 ? selectedDossier.amount.toFixed(2) : "—"}</span>
                    </div>
                    <div className="p-4 flex justify-between items-center bg-slate-50">
                      <span className="text-sm font-bold text-slate-900">{t("amount")}</span>
                      <span className="text-xl font-mono font-bold text-blue-700">{selectedDossier.amount > 0 ? selectedDossier.amount.toFixed(2) : "—"}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <SheetFooter className="p-4 border-t border-slate-200 bg-slate-100 shrink-0 justify-between items-center flex-row">
              <Button variant="ghost" size="sm" className="text-xs text-slate-600 hover:text-slate-900">
                <FileText className="mr-2 h-4 w-4" /> {tc("view")}
              </Button>
              <div className="flex gap-2">
                {selectedDossier.status === "coded" && (
                  <Button
                    className="text-xs h-8 bg-yellow-500 hover:bg-yellow-600 text-white"
                    onClick={() => handleStatusUpdate(selectedDossier.id, "validated")}
                    disabled={statusUpdating}
                  >
                    <FileCheck className="mr-2 h-3.5 w-3.5" /> {t("review_dim")}
                  </Button>
                )}
                {selectedDossier.status === "validated" && (
                  <Button
                    className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStatusUpdate(selectedDossier.id, "billed")}
                    disabled={statusUpdating}
                  >
                    <Receipt className="mr-2 h-3.5 w-3.5" /> {t("generate_invoice")}
                  </Button>
                )}
                {selectedDossier.status === "billed" && (
                  <Button variant="outline" className="text-xs h-8 bg-white" onClick={handleExportInvoice}>
                    <Download className="mr-2 h-3.5 w-3.5 text-blue-600" /> {tc("export")}
                  </Button>
                )}
                {selectedDossier.status === "paid" && (
                  <span className="text-xs font-bold uppercase tracking-wider text-green-700 flex items-center px-4 py-1.5 bg-green-100 rounded">
                    <Check className="mr-2 h-4 w-4" /> {tc("status_paid")}
                  </span>
                )}
              </div>
            </SheetFooter>
          </SheetContent>
        )}
      </Sheet>

      <Dialog open={isCodingModalOpen} onOpenChange={setIsCodingModalOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden flex flex-col gap-0 border-0 outline-none">
          <DialogHeader className="p-4 border-b border-slate-200 flex flex-row justify-between items-center bg-slate-50 space-y-0">
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Code className="h-4 w-4 text-slate-600" /> {t("enter_codes")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-y-auto space-y-4 max-h-[80vh]">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Primary Diagnosis (DP)</label>
              <Input placeholder="e.g. I21.9" className="h-9 text-xs font-mono uppercase bg-slate-50" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Associated/Comorbidities (DR/DAS)</label>
              <Input placeholder="Comma separated codes" className="h-9 text-xs font-mono uppercase" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Acts / Procedures (CCAM)</label>
              <Input placeholder="Enter CCAM codes" className="h-9 text-xs font-mono uppercase" />
            </div>
          </div>
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsCodingModalOpen(false)} className="text-xs h-8">
              {tc("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsCodingModalOpen(false);
                if (selectedDossier) {
                  handleStatusUpdate(selectedDossier.id, "coded");
                }
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8"
            >
              {tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        templateId="invoices"
        data={previewInvoice}
        facility={{ name: tc("hospital_name") }}
        settings={{ watermark: true, showLogo: false }}
      />
    </div>
  );
}
