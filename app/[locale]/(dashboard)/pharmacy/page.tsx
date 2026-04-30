"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

// Internal Components
import { PharmacyHeader } from "./_components/PharmacyHeader";
import { PrescriptionQueue } from "./_components/PrescriptionQueue";
import { InventoryTab } from "./_components/InventoryTab";
import { RxDetailSheet } from "./_components/RxDetailSheet";
import { 
  AddMedicationSheet, 
  EditMedicationSheet, 
  RestockSheet 
} from "./_components/InventorySheets";

// Types
import { PrescriptionRow, InventoryRow, MedForm } from "./types";

export default function PharmacyPage() {
  const hasModule = useAppStore((state) => state.hasModule);
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');

  // UI State
  const [activeTab, setActiveTab] = useState<"prescriptions" | "inventory">("prescriptions");
  const [rxFilter, setRxFilter] = useState("All");
  const [rxSearch, setRxSearch] = useState("");
  const [invSearch, setInvSearch] = useState("");
  const [selectedRx, setSelectedRx] = useState<PrescriptionRow | null>(null);

  // Data State
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Medication Sheets State
  const [isAddMedOpen, setIsAddMedOpen] = useState(false);
  const [medForm, setMedForm] = useState<MedForm>({ name: '', manufacturer: '', category: '', stock: 0, threshold: 0, unit: '', unitPrice: null });
  const [savingMed, setSavingMed] = useState(false);

  const [editMedOpen, setEditMedOpen] = useState(false);
  const [editMedForm, setEditMedForm] = useState<InventoryRow | null>(null);
  const [savingEditMed, setSavingEditMed] = useState(false);

  const [restockOpen, setRestockOpen] = useState(false);
  const [restockMed, setRestockMed] = useState<InventoryRow | null>(null);
  const [restockAmount, setRestockAmount] = useState(0);
  const [savingRestock, setSavingRestock] = useState(false);

  const fetchPrescriptions = async () => {
    try {
      const res = await fetch("/api/v1/pharmacy/prescriptions");
      const json = await res.json();
      if (json.success) setPrescriptions(json.data);
    } catch (e) { }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch("/api/v1/pharmacy/inventory");
      const json = await res.json();
      if (json.success) setInventory(json.data);
    } catch (e) { }
  };

  useEffect(() => {
    Promise.all([fetchPrescriptions(), fetchInventory()]).finally(() => setLoading(false));
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleValidateRx = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/pharmacy/prescriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'validated' })
      });
      if (res.ok) {
        fetchPrescriptions();
        if (selectedRx?.id === id) {
          setSelectedRx({ ...selectedRx, status: 'Validated' });
        }
      }
    } catch (e) { }
  };

  const handleDispenseRx = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/pharmacy/prescriptions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispensed' })
      });
      if (res.ok) {
        fetchPrescriptions();
        if (selectedRx?.id === id) {
          setSelectedRx({ ...selectedRx, status: 'Dispensed' });
        }
      }
    } catch (e) { }
  };

  const handleSaveMed = async () => {
    setSavingMed(true);
    try {
      const res = await fetch('/api/v1/pharmacy/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medForm)
      });
      if (res.ok) {
        setIsAddMedOpen(false);
        setMedForm({ name: '', manufacturer: '', category: '', stock: 0, threshold: 0, unit: '', unitPrice: null });
        fetchInventory();
      }
    } finally {
      setSavingMed(false);
    }
  };

  const handleUpdateMed = async () => {
    if (!editMedForm) return;
    setSavingEditMed(true);
    try {
      const res = await fetch(`/api/v1/pharmacy/inventory/${editMedForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editMedForm)
      });
      if (res.ok) {
        setEditMedOpen(false);
        fetchInventory();
      }
    } finally {
      setSavingEditMed(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/pharmacy/prescriptions/${id}/invoice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' })
      });
      if (res.ok) {
        fetchPrescriptions();
        if (selectedRx?.id === id) {
          setSelectedRx({ ...selectedRx, invoiceStatus: 'paid' });
        }
      }
    } catch (e) { }
  };

  const handleExportRx = () => {
    // TODO: Export prescriptions to PDF
    console.log('Export prescriptions');
  };

  const handleExportInventory = () => {
    // TODO: Export inventory to PDF
    console.log('Export inventory');
  };

  const handlePreviewInvoice = (rx: PrescriptionRow) => {
    // TODO: Open PDF preview modal
    console.log('Preview invoice for', rx);
  };

  const handleRestock = async () => {
    if (!restockMed) return;
    setSavingRestock(true);
    try {
      const res = await fetch(`/api/v1/pharmacy/inventory/${restockMed.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: restockMed.stock + restockAmount })
      });
      if (res.ok) {
        setRestockOpen(false);
        fetchInventory();
      }
    } finally {
      setSavingRestock(false);
    }
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
        onAddMedication={() => setIsAddMedOpen(true)}
        onExportRx={handleExportRx}
        onExportInventory={handleExportInventory}
      />

      {/* Main Content */}
      {activeTab === "prescriptions" && (
        <PrescriptionQueue 
          prescriptions={prescriptions} 
          filter={rxFilter} 
          setFilter={setRxFilter} 
          search={rxSearch} 
          setSearch={setRxSearch} 
          onSelectRx={setSelectedRx} 
          onAction={setSelectedRx} 
        />
      )}

      {activeTab === "inventory" && (
        <InventoryTab 
          inventory={inventory} 
          search={invSearch} 
          setSearch={setInvSearch} 
          onRestock={(item) => { setRestockMed(item); setRestockAmount(0); setRestockOpen(true); }} 
          onEdit={(item) => { setEditMedForm(item); setEditMedOpen(true); }} 
        />
      )}

      {/* Sheets / Modals */}
      <RxDetailSheet 
        rx={selectedRx} 
        onClose={() => setSelectedRx(null)} 
        onValidate={handleValidateRx} 
        onDispense={handleDispenseRx} 
        onMarkPaid={handleMarkPaid}
        onPreviewInvoice={handlePreviewInvoice}
      />

      <AddMedicationSheet 
        open={isAddMedOpen} 
        onOpenChange={setIsAddMedOpen} 
        form={medForm} 
        onUpdateForm={setMedForm} 
        saving={savingMed} 
        onSubmit={handleSaveMed} 
      />

      <EditMedicationSheet 
        open={editMedOpen} 
        onOpenChange={setEditMedOpen} 
        form={editMedForm} 
        onUpdateForm={setEditMedForm} 
        saving={savingEditMed} 
        onSubmit={handleUpdateMed} 
      />

      <RestockSheet 
        open={restockOpen} 
        onOpenChange={setRestockOpen} 
        med={restockMed} 
        amount={restockAmount} 
        onAmountChange={setRestockAmount} 
        saving={savingRestock} 
        onSubmit={handleRestock} 
      />
    </div>
  );
}
