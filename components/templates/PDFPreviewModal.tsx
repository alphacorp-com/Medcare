"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { AlertTriangle, Download, Loader2, Maximize2, Minimize2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pdf, type DocumentProps } from "@react-pdf/renderer";

import { InvoiceTemplate } from './InvoiceTemplate';
import { ClaimTemplate } from './ClaimTemplate';
import { PrescriptionTemplate, type PrescriptionData } from './PrescriptionTemplate';
import { LabResultTemplate, type LabResultData } from './LabResultTemplate';
import { PatientListTemplate, type PatientListData } from './PatientListTemplate';
import { StockReportTemplate, type StockReportPdfData } from './StockReportTemplate';
import { PatientFileTemplate, type PatientFileData } from './PatientFileTemplate';
import { MedicationGuideTemplate, type MedicationGuideData } from './MedicationGuideTemplate';
import { ReceiptTemplate } from './ReceiptTemplate';
import { MedicalRecordTemplate, type MedicalRecordData } from './MedicalRecordTemplate';
import { useLocale, useTranslations } from 'next-intl';
import type { PdfClaimData, PdfFacility, PdfInvoiceData, PdfReceiptData, PdfSettings } from './types';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  facility: PdfFacility;
  settings: PdfSettings;
  data?: unknown;
  // Name of the downloaded file, without extension. Defaults to "<templateId>-<yyyyMMdd>".
  fileName?: string;
}

// Outcome of one PDF generation, tagged with the content it was generated for so a stale
// result (the modal reopened on another document) is never shown.
type RenderedPdf = { key: string; url: string } | { key: string; error: true };

// The user-chosen modal size is a per-browser convenience, remembered across openings.
type ModalSize = { width: number; height: number };
const SIZE_STORAGE_KEY = 'medcare.pdfPreviewModal.size';
const MIN_WIDTH = 480;
const MIN_HEIGHT = 360;
const VIEWPORT_MARGIN = 16;

function readStoredSize(): ModalSize | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SIZE_STORAGE_KEY) ?? 'null');
    return typeof parsed?.width === 'number' && typeof parsed?.height === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

function storeSize(size: ModalSize | null) {
  try {
    if (size) window.localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
    else window.localStorage.removeItem(SIZE_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode, blocked site data): the size just isn't remembered.
  }
}

function clampSize(width: number, height: number): ModalSize {
  return {
    width: Math.round(Math.min(Math.max(width, MIN_WIDTH), window.innerWidth - VIEWPORT_MARGIN)),
    height: Math.round(Math.min(Math.max(height, MIN_HEIGHT), window.innerHeight - VIEWPORT_MARGIN)),
  };
}

export function PDFPreviewModal({ isOpen, onClose, templateId, facility, settings, data, fileName }: PDFPreviewModalProps) {
  const tDocs = useTranslations('documents');
  const tTemplates = useTranslations('templates');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState<RenderedPdf | null>(null);
  const [size, setSize] = useState<ModalSize | null>(readStoredSize);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Drag handle in the bottom-right corner. The modal is centered, so it grows on both sides:
  // the size changes by twice the pointer movement to keep the handle under the cursor.
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = contentRef.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    let latest: ModalSize = { width: box.width, height: box.height };
    setIsMaximized(false);
    setIsResizing(true);

    const onMove = (moveEvent: PointerEvent) => {
      latest = clampSize(box.width + 2 * (moveEvent.clientX - startX), box.height + 2 * (moveEvent.clientY - startY));
      setSize(latest);
    };
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      setIsResizing(false);
      storeSize(latest);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  };

  const resetSize = () => {
    setIsMaximized(false);
    setSize(null);
    storeSize(null);
  };

  const sizeStyle: React.CSSProperties | undefined = isMaximized
    ? { width: `calc(100vw - ${VIEWPORT_MARGIN}px)`, height: `calc(100dvh - ${VIEWPORT_MARGIN}px)` }
    : size
    ? { width: size.width, height: size.height }
    : undefined;

  const labels = {
    invoice: tDocs('invoice'),
    billed_to: tDocs('billed_to'),
    invoice_details: tDocs('invoice_details'),
    number: tDocs('number'),
    date: tDocs('date'),
    status: tDocs('status'),
    description: tDocs('description'),
    qty: tDocs('qty'),
    amount: tDocs('amount'),
    subtotal: tDocs('subtotal'),
    total: tDocs('total'),
    generated_by: tDocs('generated_by'),
    confidential: tDocs('confidential'),
    signature: tDocs('signature'),
    prescription: tDocs('prescription'),
    patient: tDocs('patient'),
    age: tDocs('age'),
    doctor: tDocs('doctor'),
    medications: tDocs('medications'),
    dosage: tDocs('dosage'),
    frequency: tDocs('frequency'),
    duration: tDocs('duration'),
    instructions: tDocs('instructions'),
    digitally_signed: tDocs('digitally_signed'),
    lab_report: tDocs('lab_report'),
    physician: tDocs('physician'),
    collected: tDocs('collected'),
    reported: tDocs('reported'),
    test_description: tDocs('test_description'),
    result: tDocs('result'),
    units: tDocs('units'),
    reference_range: tDocs('reference_range'),
    interpretation: tDocs('interpretation'),
    tech_sig: tDocs('tech_sig'),
    path_val: tDocs('path_val'),
    verified: tDocs('verified'),
    patient_list: tDocs('patient_list'),
    department: tDocs('department'),
    location: tDocs('location'),
    total_patients: tDocs('total_patients'),
    stock_report: tDocs('stock_report'),
    out_of_stock: tDocs('out_of_stock'),
    low_stock: tDocs('low_stock'),
    optimal: tDocs('optimal'),
    min_level: tDocs('min_level'),
    patient_file: tDocs('patient_file'),
    identification: tDocs('identification'),
    full_name: tDocs('full_name'),
    gender: tDocs('gender'),
    blood_group: tDocs('blood_group'),
    address: tDocs('address'),
    alerts: tDocs('alerts'),
    allergies: tDocs('allergies'),
    chronic_conditions: tDocs('chronic_conditions'),
    medical_history: tDocs('medical_history'),
    recent_activity: tDocs('recent_activity'),
    reason: tDocs('reason'),
    medication_guide: tDocs('medication_guide'),
    not_applicable: tCommon('not_applicable'),
    insurance_discount_applied: tDocs('insurance_discount_applied'),
    no_insurance_discount: tDocs('no_insurance_discount'),
    refund_due: tDocs('refund_due'),
    payer_share: tDocs('payer_share'),
    free_care: tDocs('free_care'),
    patient_share: tDocs('patient_share'),
    rejected_to_patient: tDocs('rejected_to_patient'),
    receipt: tDocs('receipt'),
    payment_method: tDocs('payment_method'),
    amount_paid: tDocs('amount_paid'),
    balance_remaining: tDocs('balance_remaining'),
    paid_in_full: tDocs('paid_in_full'),
  };

  const getTemplate = (): React.ReactElement<DocumentProps> | null => {
    switch (templateId) {
      case 'invoices':
        return (
          <InvoiceTemplate
            invoice={(data as { invoice?: PdfInvoiceData } | undefined)?.invoice ?? {
              number: 'INV-2024-001',
              date: new Date().toLocaleDateString(),
              patientName: 'John Doe',
              patientIpp: '123456',
              status: 'Paid',
              items: [
                { description: 'Consultation Fee', quantity: 1, amount: 15000 },
                { description: 'Laboratory - Blood Count', quantity: 1, amount: 8500 },
                { description: 'Medication - Paracetamol', quantity: 2, amount: 1200 },
              ],
              subtotal: 24700,
              total: 24700,
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'insurance_claims':
        // Always built from a real claim (billing/claims/[id]): no demo data.
        return data ? <ClaimTemplate data={data as PdfClaimData} facility={facility} settings={settings} /> : null;
      case 'prescriptions':
        return (
          <PrescriptionTemplate
            data={(data as PrescriptionData | undefined) ?? {
              patientName: 'Jane Smith',
              patientAge: '28y',
              patientGender: 'Female',
              date: new Date().toLocaleDateString(),
              prescriptionId: 'RX-7890',
              doctorName: 'Dr. Gregory House',
              doctorSpecialty: 'Internal Medicine',
              medications: [
                { name: 'Amoxicillin', dosage: '500mg', frequency: '3 times daily', duration: '7 days', instructions: 'Take after meals' },
                { name: 'Ibuprofen', dosage: '400mg', frequency: 'Twice daily', duration: '3 days', instructions: 'Only if pain persists' },
              ]
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'lab_results':
        return (
          <LabResultTemplate
            data={(data as LabResultData | undefined) ?? {
              patientName: 'Robert Brown',
              patientIpp: '987654',
              orderId: 'LAB-5542',
              dateCollected: '2024-03-20 08:30',
              dateReported: '2024-03-20 14:45',
              requestingPhysician: 'Dr. Wilson',
              results: [
                { testName: 'Hemoglobin', result: '14.2', unit: 'g/dL', referenceRange: '13.5 - 17.5' },
                { testName: 'White Blood Cell Count', result: '11.5', unit: '10^3/µL', referenceRange: '4.5 - 11.0', isCritical: true },
                { testName: 'Platelet Count', result: '250', unit: '10^3/µL', referenceRange: '150 - 450' },
              ],
              interpretation: 'Mildly elevated WBC count suggests possible infection. Correlation with clinical findings recommended.'
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'receipts':
        return (
          <ReceiptTemplate
            data={(data as PdfReceiptData | undefined) ?? {
              receiptNumber: 'RCT-2024-001',
              date: new Date().toLocaleDateString(),
              patientName: 'John Doe',
              patientIpp: '123456',
              invoiceNumber: 'INV-2024-001',
              method: 'Cash',
              amount: 15000,
              currency: 'XAF',
              balanceAfter: 0,
              isPaidInFull: true,
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'patient_lists':
        return (
          <PatientListTemplate
            data={(data as PatientListData | undefined) || {
              title: labels.patient_list,
              department: 'General Medicine - Wing B',
              date: new Date().toLocaleDateString(),
              patients: [
                { ipp: '100201', name: 'Alice Walker', gender: 'F', age: '45', bed: 'B-102', status: 'Inpatient' },
                { ipp: '100205', name: 'Bob Miller', gender: 'M', age: '62', bed: 'B-105', status: 'Surgery Scheduled' },
                { ipp: '100210', name: 'Charlie Davis', gender: 'M', age: '29', bed: 'B-110', status: 'Awaiting Discharge' },
                { ipp: '100215', name: 'Diana Ross', gender: 'F', age: '54', bed: 'B-115', status: 'Stable' },
              ]
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'medications':
        return (
          <MedicationGuideTemplate
            data={(data as MedicationGuideData | undefined) ?? {
              patientName: 'Jane Smith',
              prescriber: 'Dr. Mballa',
              date: new Date().toLocaleDateString(),
              medications: [
                { name: 'Amoxicillin 500 mg', dosage: '1 capsule', frequency: '3 times daily', duration: '7 days', instructions: 'Take after meals' },
                { name: 'Paracetamol 500 mg', dosage: '2 tablets', frequency: 'Up to 3 times daily', duration: '3 days', instructions: '' },
              ],
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'stock_reports':
        return (
          <StockReportTemplate
            data={(data as StockReportPdfData | undefined) ?? {
              period: format(new Date(), 'MM/yyyy'),
              category: 'Essential medicines',
              rows: [
                { name: 'Amoxicillin 500 mg', unit: 'caps', opening: 1200, received: 500, consumed: 640, losses: 0, adjusted: 0, closing: 1060, cmm: 610, stockoutDays: 0, vaccine: null },
                { name: 'Paracetamol 500 mg', unit: 'tabs', opening: 45, received: 0, consumed: 45, losses: 0, adjusted: 0, closing: 0, cmm: 120, stockoutDays: 9, vaccine: null },
                { name: 'BCG vaccine', unit: 'vial', opening: 20, received: 10, consumed: 12, losses: 1, adjusted: 0, closing: 17, cmm: 11, stockoutDays: 0, vaccine: { dosesAdministered: 180, dosesWasted: 60, wastageRate: 25 } },
              ],
              labels: {
                title: labels.stock_report, articles: 'Articles', in_stockout: 'Stockout', article: 'Article', opening: 'Opening',
                received: 'Received', consumed: 'Consumed', losses: 'Losses', adjusted: 'Adjusted', closing: 'Closing', cmm: 'AMC',
                stockout_days: 'Stockout days', doses_given: 'Doses given', doses_wasted: 'Doses wasted', wastage: 'Wastage', empty: '—',
              },
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'patient_files':
        return (
          <PatientFileTemplate
            data={(data as PatientFileData | undefined) || {
              patient: {
                ipp: '12345678',
                fullName: 'Samantha Richards',
                dob: '12/05/1985',
                gender: 'Female',
                phone: '+237 677 00 00 00',
                address: 'Bastos, Yaoundé, Cameroon',
                bloodGroup: 'O+',
                allergies: ['Penicillin', 'Peanuts'],
                chronicConditions: ['Hypertension', 'Type 2 Diabetes']
              },
              medicalSummary: 'Patient has been under care since 2018 for hypertension management. Shows good compliance with medication. Recent HbA1c levels are stable at 6.8%. No recent hospitalizations in the last 12 months.',
              recentVisits: [
                { date: '15/02/2024', type: 'Consultation', reason: 'Routine follow-up', doctor: 'Dr. Mballa' },
                { date: '10/12/2023', type: 'Laboratory', reason: 'Quarterly blood work', doctor: 'Lab Unit' },
                { date: '05/09/2023', type: 'Emergency', reason: 'Mild respiratory distress', doctor: 'Dr. Ngassa' },
              ]
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'medical_record':
        // No demo fallback: only ever opened with a real admission (see stays/[id]).
        return (
          <MedicalRecordTemplate
            data={data as MedicalRecordData}
            facility={facility}
            settings={settings}
            labels={tDocs.raw('medicalRecord') as Record<string, string>}
          />
        );
      default:
        return null;
    }
  };

  // Only build the document while the modal is open. Callers pass `data` as a fresh object
  // on every render, so generation is keyed on the serialized content rather than on object
  // identity — otherwise every parent re-render would regenerate the PDF.
  const documentElement = isOpen ? getTemplate() : null;
  const documentKey = documentElement ? JSON.stringify([templateId, locale, data ?? null, facility, settings]) : null;

  // Latest document element, read by the generation effect below without making it a
  // dependency (it is a new object every render). Updated in a layout effect, which runs
  // before the generation effect. (useEffectEvent would fit, but the React build bundled by
  // Next 15 doesn't export it.)
  const documentElementRef = useRef(documentElement);
  useLayoutEffect(() => {
    documentElementRef.current = documentElement;
  });

  // Generate the real PDF file (not a live preview) so the exact same bytes can be shown,
  // printed and downloaded. The blob URL is revoked when the content changes or the modal closes.
  useEffect(() => {
    if (!documentKey) return;
    let cancelled = false;
    let url: string | null = null;

    const element = documentElementRef.current;
    const generation = element
      ? pdf(element).toBlob()
      : Promise.reject(new Error(`No PDF template for "${templateId}"`));

    generation
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setRendered({ key: documentKey, url });
      })
      .catch((error: unknown) => {
        console.error(`[PDFPreviewModal] Failed to generate "${templateId}" PDF:`, error);
        if (!cancelled) setRendered({ key: documentKey, error: true });
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [documentKey, templateId]);

  const current = rendered && rendered.key === documentKey ? rendered : null;
  const pdfUrl = current && 'url' in current ? current.url : null;
  const hasError = Boolean(current && 'error' in current);
  const downloadName = `${fileName ?? `${templateId}-${format(new Date(), 'yyyyMMdd')}`}.pdf`;

  const handlePrint = () => {
    if (!pdfUrl) return;
    // Prints the PDF itself through the browser's PDF viewer in the iframe (same-origin blob
    // URL). Some browsers (notably on mobile) can't print an embedded PDF — fall back to
    // opening it in a new tab, where the viewer's own print action is available.
    try {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow) throw new Error('PDF frame not ready');
      frameWindow.focus();
      frameWindow.print();
    } catch {
      window.open(pdfUrl, '_blank', 'noopener');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        ref={contentRef}
        style={sizeStyle}
        className={cn(
          // DialogContent defaults to sm:max-w-sm — override it, or the modal stays 384px wide.
          "flex flex-col gap-0 p-0 overflow-hidden max-h-[calc(100dvh-1rem)]",
          sizeStyle ? "max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)]" : "h-[95vh] sm:max-w-6xl"
        )}
      >
        <DialogHeader className="p-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pr-12">
          <DialogTitle>{tTemplates('preview')}</DialogTitle>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex h-9 text-xs"
              onClick={() => setIsMaximized((value) => !value)}
              title={isMaximized ? tTemplates('restore_size') : tTemplates('maximize')}
              aria-label={isMaximized ? tTemplates('restore_size') : tTemplates('maximize')}
            >
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" className="h-9 text-xs bg-blue-600 hover:bg-blue-700" disabled={!pdfUrl} onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-2" /> {tCommon('print')}
            </Button>
            {pdfUrl ? (
              <a href={pdfUrl} download={downloadName} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-9 text-xs' })}>
                <Download className="h-3.5 w-3.5 mr-2" /> {tTemplates('download_pdf')}
              </a>
            ) : (
              <Button size="sm" variant="outline" className="h-9 text-xs" disabled>
                <Download className="h-3.5 w-3.5 mr-2" /> {tTemplates('download_pdf')}
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 w-full bg-slate-100 overflow-hidden relative">
          {!documentElement ? (
            <div className="p-10 text-center text-sm text-slate-500">{tTemplates('template_unavailable')}</div>
          ) : hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-red-700">
              <AlertTriangle className="h-6 w-6" />
              {tTemplates('pdf_error')}
            </div>
          ) : pdfUrl ? (
            // pointer-events off while resizing: otherwise the iframe swallows the drag.
            <iframe ref={iframeRef} src={pdfUrl} title={tTemplates('preview')} className={cn("border-0 absolute inset-0 w-full h-full", isResizing && "pointer-events-none")} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> {tTemplates('generating_pdf')}
            </div>
          )}
        </div>
        <div
          onPointerDown={startResize}
          onDoubleClick={resetSize}
          title={tTemplates('resize_hint')}
          className="hidden sm:block absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize touch-none"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-slate-400" aria-hidden="true">
            <path d="M15 6 6 15M15 11l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </DialogContent>
    </Dialog>
  );
}
