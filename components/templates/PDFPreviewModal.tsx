"use client";

import React, { useState, useEffect } from 'react';
import dynamicImport from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { PDFViewer } from "@react-pdf/renderer";

// const PDFViewer = dynamicImport(
//   () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
//   { ssr: false }
// );

import { InvoiceTemplate } from './InvoiceTemplate';
import { PrescriptionTemplate } from './PrescriptionTemplate';
import { LabResultTemplate } from './LabResultTemplate';
import { PatientListTemplate } from './PatientListTemplate';
import { StockReportTemplate } from './StockReportTemplate';
import { PatientFileTemplate } from './PatientFileTemplate';
import { MedicationGuideTemplate } from './MedicationGuideTemplate';
import { useTranslations } from 'next-intl';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  facility: any;
  settings: any;
  data?: any;
}

export function PDFPreviewModal({ isOpen, onClose, templateId, facility, settings, data }: PDFPreviewModalProps) {
  const [isClient, setIsClient] = useState(false);
  const tDocs = useTranslations('documents');
  const tTemplates = useTranslations('templates');
  const tCommon = useTranslations('common');

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

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
    how_to_take: tDocs('how_to_take'),
    best_time: tDocs('best_time'),
    warnings: tDocs('warnings'),
    side_effects: tDocs('side_effects'),
    not_applicable: tCommon('not_applicable')
  };

  const getTemplate = () => {
    switch (templateId) {
      case 'invoices':
        return (
          <InvoiceTemplate
            invoice={{
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
              total: 24700
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'prescriptions':
        return (
          <PrescriptionTemplate
            data={{
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
            data={{
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
      case 'patient_lists':
        return (
          <PatientListTemplate
            data={data || {
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
            data={{
              medicationName: 'Metformin',
              dosage: '850mg',
              patientName: 'Michael Jordan',
              instructions: 'Take one tablet with your evening meal',
              frequency: 'Once daily',
              timing: 'Evening',
              warnings: [
                'Do not take on an empty stomach',
                'Avoid excessive alcohol consumption',
                'Inform your doctor if you experience severe nausea'
              ],
              sideEffects: ['Nausea', 'Diarrhea', 'Metallic taste in mouth', 'Stomach ache']
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'stock_reports':
        return (
          <StockReportTemplate
            data={{
              title: labels.stock_report,
              category: 'Essential Medicines',
              date: new Date().toLocaleDateString(),
              stats: {
                totalItems: 450,
                outOfStock: 12,
                lowStock: 28
              },
              items: [
                { code: 'MED-001', name: 'Amoxicillin 500mg Caps', category: 'Antibiotics', stock: 1200, minStock: 500, unit: 'caps' },
                { code: 'MED-045', name: 'Paracetamol 500mg Tabs', category: 'Analgesics', stock: 45, minStock: 200, unit: 'tabs' },
                { code: 'MED-112', name: 'Insulin Glargine 100U/ml', category: 'Antidiabetic', stock: 0, minStock: 10, unit: 'vials' },
                { code: 'MED-204', name: 'Salbutamol Inhaler 100mcg', category: 'Respiratory', stock: 15, minStock: 25, unit: 'units' },
              ]
            }}
            facility={facility}
            settings={settings}
            labels={labels}
          />
        );
      case 'patient_files':
        return (
          <PatientFileTemplate
            data={data || {
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
      default:
        return <div className="p-10 text-center">Template preview for "{templateId}" is coming soon.</div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{tTemplates('preview')}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full bg-slate-100 overflow-hidden relative">
          <PDFViewer width="100%" height="100%" className="border-0 absolute inset-0">
            {getTemplate()}
          </PDFViewer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
