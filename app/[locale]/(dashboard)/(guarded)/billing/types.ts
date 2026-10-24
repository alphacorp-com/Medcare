export type BillingInvoiceStatus = "draft" | "pending_payment" | "partially_paid" | "paid" | "cancelled";
export type BillingSourceType =
  | "consultation"
  | "exam"
  | "surgery"
  | "pharmacy_dispensation"
  | "antenatal_visit"
  | "delivery"
  | "other";
// "insurance" only on payments recorded before lib/coverage: payer money now comes through claims.
// "credit_transfer": an overpayment of another invoice of the patient moved here.
export type PaymentMethod = "cash" | "card" | "insurance" | "credit_transfer" | "mobile_money_orange" | "mobile_money_mtn" | "bank_transfer";
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
  // Split of the line (lib/coverage): free-care programme, payer, the patient pays the rest.
  payerAmount: string | number;
  exemptionAmount: string | number;
  exemptionProgram: { code: string; name: string } | null;
};

export type CoverageStatus = "none" | "applied" | "capped" | "authorization_required" | "invalid_coverage" | "age_limit_exceeded" | "frozen";

export type CoverageAuthorizationOption = { id: string; number: string; authorizedAmount: string | null; validFrom: string; validTo: string };
export type CoverageOption = {
  id: string;
  relationship: "holder" | "spouse" | "child" | "other";
  validFrom: string;
  validTo: string | null;
  endedAt: string | null;
  policy: { memberNumber: string; holderName: string; endedAt: string | null; agreement: { name: string; requiresAuthorization: boolean; payer: { name: string } } };
  authorizations: CoverageAuthorizationOption[];
};

export type PatientRefund = {
  id: string;
  kind: "refund" | "transfer";
  amount: string | number;
  method: PaymentMethod | null;
  reference: string | null;
  reason: string;
  refundedAt: string;
  targetInvoice: { id: string; createdAt: string } | null;
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
  exemptionAmount: string | number;
  insurerPaidAmount: string | number;
  insurerRejectedToPatient: string | number;
  coverageId: string | null;
  authorizationId: string | null;
  coverageStatus: CoverageStatus;
  coverage: { id: string; relationship: CoverageOption["relationship"]; policy: { memberNumber: string; holderName: string; agreement: { name: string; payer: { id: string; name: string } } } } | null;
  authorization: CoverageAuthorizationOption | null;
  claimItems: {
    id: string; claimedAmount: string | number; paidAmount: string | number; rejectedAmount: string | number;
    claim: { id: string; number: string; status: string };
    rejections: { amount: string | number; reason: string; chargedToPatient: boolean }[];
  }[];
  coverageOptions: CoverageOption[];
  isClaimed: boolean;
  // Overpayment: what can be given back / moved, the refunds and transfers made, money received
  // from other invoices of the patient.
  refundable: number;
  refunds: PatientRefund[];
  creditsIn: { id: string; amount: string | number; refundedAt: string; invoiceId: string }[];
  transferTargets: { id: string; createdAt: string; stayNumber: string | null; due: number }[];
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
