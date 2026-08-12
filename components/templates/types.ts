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
}
