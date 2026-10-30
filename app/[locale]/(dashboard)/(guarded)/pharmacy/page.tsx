"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type { PagedResponse } from "@/lib/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { DEFAULT_PAGE_SIZE, PaginationBar } from "@/components/shared/pagination-bar";
import { useTranslations } from "next-intl";

// Internal Components
import { PharmacyHeader } from "./_components/PharmacyHeader";
import { PrescriptionQueue } from "./_components/PrescriptionQueue";
import { InventoryTab } from "./_components/InventoryTab";
import { RxDetailSheet } from "./_components/RxDetailSheet";
import { useUrlTab } from "@/hooks/use-url-tab";
import { AddMedicationSheet, EditMedicationSheet, useInventoryReferences } from "./_components/InventorySheets";
import { LossSheet, ReceiptSheet, StockDetailSheet, TransferSheet } from "./_components/StockSheets";
import { StockReportTab } from "./_components/StockReportTab";
import { useStockErrorMessage } from "@/components/shared/use-stock-error-message";

// Types
import { AdverseReactionsTab } from "./_components/AdverseReactionsTab";
import { PrescriptionRow, InventoryRow, MedForm, PharmacyTab } from "./types";
import { notifyBillingGeneratedMany } from "@/lib/billing/client";

type PrescriptionListResponse = PagedResponse<PrescriptionRow, Partial<Record<"pending" | "validated" | "dispensed", number>>>;
// Queue tab → stored status filter sent to the API.
const RX_FILTER_STATUS: Record<string, string | undefined> = {
  "Pending Queue": "pending",
  Validated: "validated",
  Dispensed: "dispensed",
};
const EMPTY_MED_FORM: MedForm = { name: '', manufacturer: '', category: '', threshold: 0, unit: '', unitPrice: null, storageLocationId: null, supplierId: null, rma3Category: null, rma3Treatment: null, vaccineAntigenCode: null, dosesPerUnit: 1, openVialHours: null };
const rxKeys = {
  all: ["pharmacy", "prescriptions"] as const,
  one: (id: string | null) => ["pharmacy", "prescriptions", "one", id] as const,
};

function PharmacyPageContent() {
  const hasModule = useAppStore((state) => state.hasModule);
  const hasPermission = useAppStore((state) => state.hasPermission);
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');
  const stockError = useStockErrorMessage();

  // UI State
  // The tab is in the URL (?tab=): dashboard stock alerts and the sidebar sub-items open it.
  const [activeTab, setActiveTab] = useUrlTab<PharmacyTab>(["prescriptions", "inventory", "report", "pharmacovigilance"], "prescriptions");
  const [rxFilter, setRxFilter] = useState("All");
  const [rxSearch, setRxSearch] = useState("");
  const [invSearch, setInvSearch] = useState("");
  const [rxPage, setRxPage] = useState(1);
  const [rxPageSize, setRxPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedRxId, setSelectedRxId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Data State — the queue is filtered, searched (debounced) and paged on the server.
  const debouncedRxSearch = useDebouncedValue(rxSearch.trim(), 300);
  const rxQuery = useQuery({
    queryKey: [...rxKeys.all, "list", { rxFilter, search: debouncedRxSearch, rxPage, rxPageSize }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(rxPage), pageSize: String(rxPageSize) });
      const status = RX_FILTER_STATUS[rxFilter];
      if (status) params.set("status", status);
      if (debouncedRxSearch) params.set("search", debouncedRxSearch);
      return apiFetch<PrescriptionListResponse>(`/api/v1/pharmacy/prescriptions?${params}`);
    },
    enabled: hasModule("MODULE_PHARMACY"),
    placeholderData: keepPreviousData,
  });
  const prescriptions = rxQuery.data?.data ?? [];
  const inventoryQuery = useQuery({
    queryKey: ["pharmacy", "inventory"],
    queryFn: () => apiFetch<{ data: InventoryRow[] }>("/api/v1/pharmacy/inventory"),
    enabled: hasModule("MODULE_PHARMACY"),
  });
  const inventory = inventoryQuery.data?.data ?? [];

  // The open prescription is loaded by id (?id= on the list API), so a dashboard link
  // (?rx=<id>) or an update that moves it to another tab never loses it.
  const linkedRxId = useSearchParams().get("rx");
  const [rxLinkDismissed, setRxLinkDismissed] = useState(false);
  const openRxId = selectedRxId ?? (rxLinkDismissed ? null : linkedRxId);
  const openRxQuery = useQuery({
    queryKey: rxKeys.one(openRxId),
    queryFn: () => apiFetch<PrescriptionListResponse>(`/api/v1/pharmacy/prescriptions?id=${encodeURIComponent(openRxId ?? "")}`),
    enabled: Boolean(openRxId) && hasModule("MODULE_PHARMACY"),
  });
  const openRx = openRxId ? (openRxQuery.data?.data[0] ?? prescriptions.find((rx) => rx.id === openRxId) ?? null) : null;
  const refreshPrescriptions = () => queryClient.invalidateQueries({ queryKey: rxKeys.all });

  // Medication Sheets State
  const [isAddMedOpen, setIsAddMedOpen] = useState(false);
  const [medForm, setMedForm] = useState<MedForm>(EMPTY_MED_FORM);
  const [savingMed, setSavingMed] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);

  const [editMedOpen, setEditMedOpen] = useState(false);
  const [editMedForm, setEditMedForm] = useState<InventoryRow | null>(null);
  const [savingEditMed, setSavingEditMed] = useState(false);
  const [editMedError, setEditMedError] = useState<string | null>(null);

  // Stock movements of one article (receipt, loss) and its lots/journal.
  const [receiptItem, setReceiptItem] = useState<InventoryRow | null>(null);
  const [lossItem, setLossItem] = useState<InventoryRow | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryRow | null>(null);
  const [transferItem, setTransferItem] = useState<InventoryRow | null>(null);
  const { suppliers, locations } = useInventoryReferences();

  // Called after adding or editing a medication.
  const fetchInventory = () => queryClient.invalidateQueries({ queryKey: ["pharmacy", "inventory"] });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleValidateRx = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/pharmacy/prescriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'validated' })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        notifyBillingGeneratedMany(json?.billing, tc("invoice_generated"));
      } else {
        // e.g. 409 when it was validated meanwhile (another pharmacist, double click).
        toast.error(json?.error || tc("unknown_error"));
      }
      await refreshPrescriptions();
    } catch {
      toast.error(tc("unknown_error"));
    }
  };

  const handleDispenseRx = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/pharmacy/prescriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispensed' })
      });
      if (!res.ok) {
        // e.g. 409 when it was already dispensed or a drug lacks usable stock, or 400 while
        // the invoice is unpaid.
        const json = await res.json().catch(() => ({}));
        toast.error(stockError(json) ?? (json?.error || tc("unknown_error")));
      }
      await refreshPrescriptions();
    } catch {
      toast.error(tc("unknown_error"));
    }
  };

  // Cancels a prescription before dispensing (reason required; unpaid charges are removed).
  const handleCancelRx = async (id: string, reason: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/v1/pharmacy/prescriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return json?.error || tc("unknown_error");
      toast.success(t("cancel_rx_done"));
      await refreshPrescriptions();
      return null;
    } catch {
      return tc("unknown_error");
    }
  };

  const handleSaveMed = async () => {
    setSavingMed(true);
    setMedError(null);
    try {
      const res = await fetch('/api/v1/pharmacy/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medForm)
      });
      if (res.ok) {
        setIsAddMedOpen(false);
        setMedForm(EMPTY_MED_FORM);
        fetchInventory();
      } else {
        const json = await res.json().catch(() => ({}));
        setMedError(stockError(json) ?? (json?.error || tc("unknown_error")));
      }
    } catch {
      setMedError(tc("unknown_error"));
    } finally {
      setSavingMed(false);
    }
  };

  const handleUpdateMed = async () => {
    if (!editMedForm) return;
    setSavingEditMed(true);
    setEditMedError(null);
    try {
      const res = await fetch(`/api/v1/pharmacy/inventory/${editMedForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editMedForm)
      });
      if (res.ok) {
        setEditMedOpen(false);
        fetchInventory();
      } else {
        const json = await res.json().catch(() => ({}));
        setEditMedError(stockError(json) ?? (json?.error || tc("unknown_error")));
      }
    } catch {
      setEditMedError(tc("unknown_error"));
    } finally {
      setSavingEditMed(false);
    }
  };

  const handleExportRx = () => {
    // TODO: Export prescriptions to PDF
    console.log('Export prescriptions');
  };

  const handleExportInventory = () => {
    // TODO: Export inventory to PDF
    console.log('Export inventory');
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!hasModule('MODULE_PHARMACY')) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{tc('restricted_access')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('module_desc')}</p>
          <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
            {tc('contact_admin')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <PharmacyHeader
        tab={activeTab}
        onTabChange={setActiveTab}
        onAddMedication={() => { setMedError(null); setIsAddMedOpen(true); }}
        onExportRx={handleExportRx}
        onExportInventory={handleExportInventory}
      />

      {/* Main Content */}
      {activeTab === "prescriptions" && (
        <PrescriptionQueue
          prescriptions={prescriptions}
          filter={rxFilter}
          search={rxSearch}
          onSelectRx={(rx) => setSelectedRxId(rx.id)}
          onAction={(rx) => setSelectedRxId(rx.id)}
          counts={rxQuery.data?.counts}
          setFilter={(next) => { setRxFilter(next); setRxPage(1); }}
          setSearch={(next) => { setRxSearch(next); setRxPage(1); }}
        />
      )}
      {activeTab === "prescriptions" && (
        <PaginationBar
          page={rxPage}
          pageSize={rxPageSize}
          total={rxQuery.data?.total ?? 0}
          onPageChange={setRxPage}
          onPageSizeChange={(size) => { setRxPageSize(size); setRxPage(1); }}
        />
      )}

      {activeTab === "inventory" && (
        <InventoryTab
          inventory={inventory}
          search={invSearch}
          setSearch={setInvSearch}
          onReceipt={setReceiptItem}
          onLoss={setLossItem}
          onDetail={setDetailItem}
          onTransfer={setTransferItem}
          onEdit={(item) => { setEditMedForm(item); setEditMedError(null); setEditMedOpen(true); }}
        />
      )}

      {/* Sheets / Modals */}
      <RxDetailSheet
        rx={openRx}
        onClose={() => {
          setSelectedRxId(null);
          setRxLinkDismissed(true);
        }}
        onValidate={handleValidateRx}
        onDispense={handleDispenseRx}
        onCancel={handleCancelRx}
      />

      <AddMedicationSheet
        open={isAddMedOpen}
        onOpenChange={setIsAddMedOpen}
        form={medForm}
        onUpdateForm={setMedForm}
        saving={savingMed}
        error={medError}
        onSubmit={handleSaveMed}
      />

      <EditMedicationSheet
        open={editMedOpen}
        onOpenChange={setEditMedOpen}
        form={editMedForm}
        onUpdateForm={setEditMedForm}
        saving={savingEditMed}
        error={editMedError}
        onSubmit={handleUpdateMed}
      />

      {activeTab === "report" && <StockReportTab />}
      {/* UI only: the routes check MODULE_PHARMACY server-side. */}
      {activeTab === "pharmacovigilance" && (
        <AdverseReactionsTab inventory={inventory} canCreate={hasPermission("MODULE_PHARMACY", "create")} canUpdate={hasPermission("MODULE_PHARMACY", "update")} />
      )}

      <ReceiptSheet item={receiptItem} suppliers={suppliers} locations={locations} onOpenChange={() => setReceiptItem(null)} />
      <TransferSheet item={transferItem} locations={locations} onOpenChange={() => setTransferItem(null)} />
      <LossSheet item={lossItem} onOpenChange={() => setLossItem(null)} />
      <StockDetailSheet item={detailItem} onOpenChange={() => setDetailItem(null)} />
    </div>
  );
}

// useSearchParams (dashboard deep links) needs a Suspense boundary.
export default function PharmacyPage() {
  return (
    <Suspense fallback={null}>
      <PharmacyPageContent />
    </Suspense>
  );
}
