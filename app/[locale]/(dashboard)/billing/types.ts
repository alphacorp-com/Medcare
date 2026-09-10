export type BillingInvoiceStatus = "draft" | "pending_payment" | "partially_paid" | "paid" | "cancelled";
export type BillingSourceType =
  | "consultation"
  | "exam"
  | "surgery"
  | "pharmacy_dispensation"
  | "antenatal_visit"
  | "delivery"
  | "other";
export type PaymentMethod = "cash" | "card" | "insurance" | "mobile_money_orange" | "mobile_money_mtn" | "bank_transfer";
export type PaymentStatus = "pending" | "successful" | "failed" | "cancelled";

export type InvoiceListItem = {
  id: string;
  patientName: string;
  ipp: string;
  stayNumber: string | null;
  status: BillingInvoiceStatus;
  subtotal: number;
  insuranceAmount: number;
  patientAmount: number;
  paidAmount: number;
  currency: string;
  lineCount: number;
  createdAt: string;
};

export type InvoiceLine = {
  id: string;
  sourceType: BillingSourceType;
  sourceId: string | null;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  amount: string | number;
  createdAt: string;
};

export type Payment = {
  id: string;
  amount: string | number;
  method: PaymentMethod;
  status: PaymentStatus;
  currency: string;
  phoneNumber: string | null;
  providerReference: string | null;
  failureReason: string | null;
  initiatedAt: string;
  completedAt: string | null;
};

export type InvoiceDetail = {
  id: string;
  patientId: string;
  stayId: string | null;
  status: BillingInvoiceStatus;
  subtotal: string | number;
  insuranceAmount: string | number;
  patientAmount: string | number;
  paidAmount: string | number;
  currency: string;
  notes: string | null;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string; ipp: string };
  stay: { id: string; stayNumber: string; admissionDate: string; dischargeDate: string | null } | null;
  lines: InvoiceLine[];
  payments: Payment[];
};

export type FeeScheduleItem = {
  id: string;
  sourceType: BillingSourceType;
  code: string;
  label: string;
  unitPrice: string | number;
  isActive: boolean;
};

export const SOURCE_TYPES: BillingSourceType[] = [
  "consultation",
  "exam",
  "surgery",
  "pharmacy_dispensation",
  "antenatal_visit",
  "delivery",
  "other",
];
