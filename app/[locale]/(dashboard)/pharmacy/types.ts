export type PrescriptionRow = {
  id: string;
  patientName: string;
  prescriber: string;
  date: string;
  status: string;
  items: number;
  itemsData: any[];
  alert: boolean;
  ipp: string;
};

export type InventoryRow = {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  stock: number;
  threshold: number;
  unit: string;
  isActive: boolean;
};

export type MedForm = {
  name: string;
  manufacturer: string;
  category: string;
  stock: number;
  threshold: number;
  unit: string;
};
