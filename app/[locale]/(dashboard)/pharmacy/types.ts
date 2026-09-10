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
};

export type MedForm = {
  name: string;
  manufacturer: string;
  category: string;
  stock: number;
  threshold: number;
  unit: string;
  unitPrice: number | null;
  storageLocationId: string | null;
  supplierId: string | null;
};

export type StorageLocationOption = { id: string; code: string; name: string };
export type SupplierOption = { id: string; code: string; name: string };
