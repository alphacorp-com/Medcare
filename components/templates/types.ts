// Shared prop shapes for the @react-pdf/renderer document templates in this folder.

export interface PdfFacility {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  taxId?: string;
  department?: string;
}

export interface PdfSettings {
  showLogo: boolean;
  includeQR: boolean;
  digitalSignature: boolean;
  watermark: boolean;
}

// Label bags are template-specific supersets of translated strings assembled by the
// caller (see PDFPreviewModal) — a plain string dictionary is the honest shape here,
// each template only reads the handful of keys it actually renders.
export type PdfLabels = Record<string, string>;

export interface PdfInvoiceData {
  number: string;
  date: string;
  patientName: string;
  patientIpp: string;
  status: string;
  items: { description: string; quantity: number; amount: number }[];
  subtotal: number;
  total: number;
  // Optional: when provided, InvoiceTemplate renders the insurance-discount and
  // refund-due lines. Omitted entirely by call sites that only have the flat
  // subtotal/total (e.g. the settings-page preview's demo data).
  insuranceAmount?: number;
  // Third-party payment (lib/coverage): payer and member number, free-care share, rejected payer
  // share charged back to the patient.
  payerName?: string;
  exemptionAmount?: number;
  rejectedToPatient?: number;
  patientAmount?: number;
  paidAmount?: number;
  refundDue?: number;
}

// Claim to a payer (ClaimTemplate). Labels are translated by the caller.
export interface PdfClaimData {
  number: string;
  status: string;
  payerName: string;
  period: string;
  submittedOn: string | null;
  currency: string;
  notes: string | null;
  items: {
    date: string;
    patient: string;
    ipp: string;
    memberNumber: string;
    beneficiary: string;
    authorization: string | null;
    invoiceAmount: number;
    claimed: number;
    paid: number;
    rejected: number;
  }[];
  labels: Record<
    | 'title' | 'status' | 'payer' | 'period' | 'submitted_on' | 'invoices' | 'date' | 'patient' | 'member' | 'beneficiary' | 'authorization'
    | 'invoice_amount' | 'claimed' | 'paid' | 'rejected' | 'totals' | 'outstanding' | 'facility_signature' | 'payer_signature',
    string
  >;
}

export interface PdfReceiptData {
  receiptNumber: string;
  date: string;
  patientName: string;
  patientIpp: string;
  invoiceNumber: string;
  method: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  isPaidInFull: boolean;
}
