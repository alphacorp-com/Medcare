import type { Rma3StockCategory, Rma3Treatment } from "@/lib/stock/input";

export type PrescriptionRow = {
  id: string;
  patientName: string;
  prescriber: string;
  date: string;
  status: string;
  items: number;
  itemsData: PrescriptionItemData[];
  alert: boolean;
  ipp: string;
  totalCost?: number;
  invoiceId?: string | null;
  invoiceStatus?: string | null;
  invoiceTotal?: number | null;
  patientId?: string;
  stayId?: string | null;
};

export type PrescriptionItemData = {
  drug?: string;
  name?: string;
  dose?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity?: string | number;
  stockStatus: 'in_stock' | 'out_of_stock' | 'not_in_inventory';
  inventoryStock: number;
  unitPrice: number | null;
  inventoryId: string | null;
};

export type InventoryRow = {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  stock: number;
  threshold: number;
  unit: string;
  unitPrice: number | null;
  isActive: boolean;
  storageLocationId: string | null;
  supplierId: string | null;
  rma3Category: Rma3StockCategory | null;
  rma3Treatment: Rma3Treatment | null;
  vaccineAntigenCode: string | null;
  dosesPerUnit: number;
  openVialHours: number | null;
  // From the lots (GET /api/v1/pharmacy/inventory): units that can be dispensed now
  // (non-expired, dispensing depot), still on the shelf but expired, and expiring within
  // 90 days; nearest expiry of the usable lots.
  dispensableStock: number;
  expiredQuantity: number;
  expiringSoonQuantity: number;
  nearestExpiry: string | null;
};

// Article settings. The stock is not part of it: it only changes through movements.
export type MedForm = {
  name: string;
  manufacturer: string;
  category: string;
  threshold: number;
  unit: string;
  unitPrice: number | null;
  storageLocationId: string | null;
  supplierId: string | null;
  rma3Category: Rma3StockCategory | null;
  rma3Treatment: Rma3Treatment | null;
  vaccineAntigenCode: string | null;
  dosesPerUnit: number;
  openVialHours: number | null;
};

export type StockLotRow = {
  id: string;
  locationId: string;
  locationName: string;
  lotNumber: string;
  expiryDate: string | null;
  quantity: number;
  receivedAt: string;
  isExpired: boolean;
};

export type StockMovementRow = {
  id: string;
  type: "opening_balance" | "receipt" | "dispensing" | "vaccination" | "expired" | "damaged" | "lost" | "adjustment" | "transfer_out" | "transfer_in";
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  lotNumber: string | null;
  locationName: string;
  occurredAt: string;
  recordedByName: string | null;
};

export type OpenVialRow = {
  id: string;
  lotNumber: string;
  dosesPerVial: number;
  dosesLeft: number;
  openedAt: string;
  discardAt: string;
};

export type PharmacyTab = "prescriptions" | "inventory" | "report" | "pharmacovigilance";

export type StorageLocationOption = { id: string; code: string; name: string };
export type SupplierOption = { id: string; code: string; name: string };
