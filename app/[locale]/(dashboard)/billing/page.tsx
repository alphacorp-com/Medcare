"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import { Search, Plus, FileClock, Banknote, CheckCircle2, Receipt } from "lucide-react";
import { NewInvoiceSheet } from "./_components/NewInvoiceSheet";
import { FeeScheduleTab } from "./_components/FeeScheduleTab";
import { InvoiceListItem, BillingInvoiceStatus } from "./types";

const FILTERS: (BillingInvoiceStatus | "all")[] = ["all", "pending_payment", "partially_paid", "paid"];

export default function BillingPage() {
  const t = useTranslations("billing");
  const tc = useTranslations("common");
  const hasModule = useAppStore((state) => state.hasModule);
  const router = useRouter();

  const [filter, setFilter] = useState<BillingInvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const fetchInvoices = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/v1/billing?${params.toString()}`);
      const json = await res.json();
      setInvoices(Array.isArray(json.data) ? json.data : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasModule("MODULE_BILLING")) return;
    (async () => {
      await fetchInvoices();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasModule, filter, search]);

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

  const count = (s: BillingInvoiceStatus) => invoices.filter((i) => i.status === s).length;
  const totalOutstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((sum, i) => sum + (i.patientAmount - i.paidAmount), 0);

  const statusBadgeClass = (status: BillingInvoiceStatus) =>
    cn(
      "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
      status === "paid" ? "bg-green-100 text-green-700" :
      status === "partially_paid" ? "bg-yellow-100 text-yellow-700" :
      status === "cancelled" ? "bg-slate-100 text-slate-500" :
      "bg-blue-100 text-blue-700"
    );

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="mb-3 sm:mb-0">
          <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
          <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
        </div>
        <div className="grid grid-cols-1 sm:flex sm:items-center sm:gap-2 gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto flex items-center justify-center"
            onClick={() => setIsNewOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-2" /> {t("new_invoice")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 shrink-0">
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between cursor-pointer hover:border-blue-300" onClick={() => setFilter("pending_payment")}>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t("pending_payment")}</div>
            <div className="text-3xl font-bold text-slate-900">{count("pending_payment")}</div>
          </div>
          <FileClock className="h-8 w-8 text-slate-200" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between cursor-pointer hover:border-blue-300" onClick={() => setFilter("partially_paid")}>
          <div>
            <div className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-1">{t("partially_paid")}</div>
            <div className="text-3xl font-bold text-yellow-600">{count("partially_paid")}</div>
          </div>
          <Banknote className="h-8 w-8 text-yellow-100" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between cursor-pointer hover:border-blue-300" onClick={() => setFilter("paid")}>
          <div>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">{t("paid")}</div>
            <div className="text-3xl font-bold text-green-600">{count("paid")}</div>
          </div>
          <CheckCircle2 className="h-8 w-8 text-green-100" />
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">{t("outstanding_balance")}</div>
            <div className="text-2xl font-bold text-blue-700">{totalOutstanding.toLocaleString()} <span className="text-xs">XAF</span></div>
          </div>
          <Receipt className="h-8 w-8 text-blue-100" />
        </div>
      </div>

      <Tabs defaultValue="invoices" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="bg-white border border-slate-200 shadow-sm h-auto p-1 w-fit shrink-0 flex-wrap">
          <TabsTrigger value="invoices" className="text-xs data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            {t("invoices")}
          </TabsTrigger>
          <TabsTrigger value="fee_schedule" className="text-xs data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            {t("fee_schedule")}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden mt-4 flex flex-col">
          <TabsContent value="invoices" className="m-0 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    type="search"
                    placeholder={tc("search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 w-full"
                  />
                </div>
                <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-md mt-2 sm:mt-0 sm:ml-4">
                  {FILTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={cn(
                        "px-3 py-1 rounded text-[10px] font-semibold transition-colors",
                        filter === s ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      {s === "all" ? tc("all") : t(s)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                        <th className="p-4 font-semibold w-48">{tc("patient")}</th>
                        <th className="p-4 font-semibold w-32">{t("stay")}</th>
                        <th className="p-4 font-semibold w-32">{tc("date")}</th>
                        <th className="p-4 font-semibold text-right w-32">{t("total")}</th>
                        <th className="p-4 font-semibold text-right w-32">{t("paid")}</th>
                        <th className="p-4 font-semibold w-40">{tc("status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {invoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/billing/${invoice.id}`)}
                        >
                          <td className="p-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2 text-sm">
                              <span>{invoice.patientName}</span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{invoice.ipp}</div>
                          </td>
                          <td className="p-4 font-mono text-xs text-slate-600">{invoice.stayNumber || t("outpatient")}</td>
                          <td className="p-4 text-sm text-slate-500">{format(new Date(invoice.createdAt), "MMM dd, yyyy")}</td>
                          <td className="p-4 text-right font-mono text-sm text-slate-700">{invoice.subtotal.toLocaleString()}</td>
                          <td className="p-4 text-right font-mono text-sm text-green-700">{invoice.paidAmount.toLocaleString()}</td>
                          <td className="p-4">
                            <span className={statusBadgeClass(invoice.status)}>{t(invoice.status)}</span>
                          </td>
                        </tr>
                      ))}
                      {!isLoading && invoices.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-500 text-sm">{tc("no_data")}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fee_schedule" className="m-0 flex-1 flex flex-col overflow-hidden">
            <FeeScheduleTab />
          </TabsContent>
        </div>
      </Tabs>

      <NewInvoiceSheet
        open={isNewOpen}
        onOpenChange={setIsNewOpen}
        onCreated={(invoiceId) => router.push(`/billing/${invoiceId}`)}
      />
    </div>
  );
}
