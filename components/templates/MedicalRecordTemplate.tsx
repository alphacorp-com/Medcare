import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PdfFacility, PdfLabels, PdfSettings } from './types';

// The medical record of one admission: identification, reason for admission, notes
// (consultation and complementary), prescribed medications and every exam with its
// results — printed from the admission screen.

export interface MedicalRecordParameter {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: string;
  section?: string;
}

export interface MedicalRecordData {
  patient: {
    fullName: string;
    ipp: string;
    birthDate: string;
    gender: string;
    bloodGroup?: string | null;
    allergies: string[];
    chronicConditions: string[];
  };
  stay: {
    number: string;
    type: string;
    admissionDate: string;
    dischargeDate?: string | null;
    reason?: string | null;
    act?: string | null;
    attendingDoctor?: string | null;
    hospitalization?: string | null;
    dischargeSummary?: string | null;
  };
  vitals?: string | null;
  notes: { date: string; type: string; title?: string | null; author: string; content: string }[];
  prescriptions: { date: string; prescriber: string; items: { drug: string; dosage: string; frequency: string; duration: string }[] }[];
  exams: {
    date: string;
    label: string;
    category: string;
    status: string;
    performer?: string | null;
    validator?: string | null;
    validatedAt?: string | null;
    parameters: MedicalRecordParameter[];
    findings?: string | null;
    impression?: string | null;
  }[];
}

// Helvetica (the only font available offline) is WinAnsi-encoded: symbols outside it would
// print as garbage, so they are spelled out.
const PDF_SAFE: Record<string, string> = {
  '≥': '>=', '≤': '<=', '≈': '~', '→': '->', '⁺': '+', '⁻': '-', 'ᵉ': 'e',
  '⁰': '^0', '⁴': '^4', '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
};
const safe = (text: string | null | undefined) => (text ?? '').replace(/[≥≤≈→⁺⁻ᵉ⁰⁴-⁹₀-₄]/g, (char) => PDF_SAFE[char] ?? char);

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 56, fontSize: 9, color: '#334155', fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 10, marginBottom: 14 },
  facilityName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'center', marginBottom: 14, textTransform: 'uppercase' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: '#1e293b', backgroundColor: '#f1f5f9', padding: 4, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#2563eb' },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 110, fontFamily: 'Helvetica-Bold', color: '#64748b' },
  value: { flex: 1 },
  block: { marginBottom: 8, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  bold: { fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  muted: { color: '#64748b', fontSize: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', paddingVertical: 2, marginTop: 3 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', paddingVertical: 2 },
  cellName: { width: '34%', paddingRight: 4 },
  cellValue: { width: '22%', paddingRight: 4 },
  cellUnit: { width: '10%', paddingRight: 4 },
  cellRef: { width: '24%', paddingRight: 4 },
  cellFlag: { width: '10%' },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: '#64748b' },
  sectionRow: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: '#1d4ed8', marginTop: 3 },
  abnormal: { fontFamily: 'Helvetica-Bold', color: '#c2410c' },
  critical: { fontFamily: 'Helvetica-Bold', color: '#dc2626' },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#94a3b8', borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 6 },
});

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{safe(value)}</Text>
    </View>
  );
}

function ParametersTable({ parameters, labels }: { parameters: MedicalRecordParameter[]; labels: PdfLabels }) {
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={[styles.cellName, styles.th]}>{labels.parameter}</Text>
        <Text style={[styles.cellValue, styles.th]}>{labels.result}</Text>
        <Text style={[styles.cellUnit, styles.th]}>{labels.unit}</Text>
        <Text style={[styles.cellRef, styles.th]}>{labels.reference}</Text>
        <Text style={[styles.cellFlag, styles.th]}>{labels.flag}</Text>
      </View>
      {parameters.map((p, i) => {
        const showSection = p.section && p.section !== parameters[i - 1]?.section;
        const valueStyle = p.flag === 'critical' ? styles.critical : p.flag === 'normal' ? undefined : styles.abnormal;
        return (
          <View key={i} wrap={false}>
            {showSection ? <Text style={styles.sectionRow}>{safe(p.section)}</Text> : null}
            <View style={styles.tableRow}>
              <Text style={styles.cellName}>{safe(p.name)}</Text>
              <Text style={[styles.cellValue, valueStyle ?? {}]}>{safe(p.value)}</Text>
              <Text style={styles.cellUnit}>{safe(p.unit)}</Text>
              <Text style={styles.cellRef}>{safe(p.referenceRange)}</Text>
              <Text style={[styles.cellFlag, valueStyle ?? {}]}>{labels[`flag_${p.flag}`] ?? p.flag}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export const MedicalRecordTemplate = ({
  data,
  facility,
  settings,
  labels,
}: {
  data: MedicalRecordData;
  facility: PdfFacility;
  settings: PdfSettings;
  labels: PdfLabels;
}) => (
  <Document title={`${labels.title} — ${data.patient.fullName}`}>
    <Page size="A4" style={styles.page}>
      <View style={styles.header} fixed>
        <View>
          <Text style={styles.facilityName}>{safe(facility.name)}</Text>
          {facility.address ? <Text style={styles.muted}>{safe(facility.address)}</Text> : null}
          {facility.phone ? <Text style={styles.muted}>{safe(facility.phone)}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.bold}>{safe(data.patient.fullName)}</Text>
          <Text>IPP : {data.patient.ipp}</Text>
          <Text>{labels.stay} : {data.stay.number}</Text>
        </View>
      </View>

      <Text style={styles.title}>{labels.title}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. {labels.identification}</Text>
        <Field label={labels.full_name} value={data.patient.fullName} />
        <Field label={labels.birth_date} value={data.patient.birthDate} />
        <Field label={labels.gender} value={data.patient.gender} />
        <Field label={labels.blood_group} value={data.patient.bloodGroup} />
        <Field label={labels.allergies} value={data.patient.allergies.join(', ') || labels.none} />
        <Field label={labels.chronic_conditions} value={data.patient.chronicConditions.join(', ') || labels.none} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. {labels.admission}</Text>
        <Field label={labels.admission_date} value={data.stay.admissionDate} />
        <Field label={labels.admission_type} value={data.stay.type} />
        <Field label={labels.medical_act} value={data.stay.act} />
        <Field label={labels.reason} value={data.stay.reason} />
        <Field label={labels.attending_doctor} value={data.stay.attendingDoctor} />
        <Field label={labels.hospitalization} value={data.stay.hospitalization} />
        <Field label={labels.vitals} value={data.vitals} />
        <Field label={labels.discharge_date} value={data.stay.dischargeDate} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. {labels.notes}</Text>
        {data.notes.length === 0 ? <Text style={styles.muted}>{labels.none}</Text> : null}
        {data.notes.map((note, i) => (
          <View key={i} style={styles.block} wrap={false}>
            <View style={styles.blockHeader}>
              <Text style={styles.bold}>{note.type}{note.title ? ` — ${safe(note.title)}` : ''}</Text>
              <Text style={styles.muted}>{note.date} · {safe(note.author)}</Text>
            </View>
            <Text style={{ lineHeight: 1.4 }}>{safe(note.content)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. {labels.medications}</Text>
        {data.prescriptions.length === 0 ? <Text style={styles.muted}>{labels.none}</Text> : null}
        {data.prescriptions.map((rx, i) => (
          <View key={i} style={styles.block} wrap={false}>
            <View style={styles.blockHeader}>
              <Text style={styles.bold}>{labels.prescription} {rx.date}</Text>
              <Text style={styles.muted}>{safe(rx.prescriber)}</Text>
            </View>
            {rx.items.map((item, j) => (
              <Text key={j}>
                • {safe(item.drug)}{[item.dosage, item.frequency, item.duration].filter(Boolean).length ? ` — ${safe([item.dosage, item.frequency, item.duration].filter(Boolean).join(', '))}` : ''}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. {labels.exams}</Text>
        {data.exams.length === 0 ? <Text style={styles.muted}>{labels.none}</Text> : null}
        {data.exams.map((exam, i) => (
          <View key={i} style={styles.block}>
            <View style={styles.blockHeader} wrap={false}>
              <Text style={styles.bold}>{safe(exam.label)} <Text style={styles.muted}>({exam.category})</Text></Text>
              <Text style={styles.muted}>{exam.date} · {exam.status}</Text>
            </View>
            {exam.parameters.length > 0 ? <ParametersTable parameters={exam.parameters} labels={labels} /> : null}
            {exam.findings ? <Text style={{ marginTop: 3 }}><Text style={styles.bold}>{labels.findings} : </Text>{safe(exam.findings)}</Text> : null}
            {exam.impression ? <Text style={{ marginTop: 3 }}><Text style={styles.bold}>{labels.impression} : </Text>{safe(exam.impression)}</Text> : null}
            {exam.parameters.length === 0 && !exam.findings && !exam.impression ? <Text style={styles.muted}>{labels.no_result}</Text> : null}
            {exam.performer || exam.validator ? (
              <Text style={[styles.muted, { marginTop: 3 }]}>
                {exam.performer ? `${labels.performed_by} : ${safe(exam.performer)}` : ''}
                {exam.validator ? `   ${labels.validated_by} : ${safe(exam.validator)}${exam.validatedAt ? ` (${exam.validatedAt})` : ''}` : ''}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {data.stay.dischargeSummary ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. {labels.discharge_summary}</Text>
          <Text style={{ lineHeight: 1.4 }}>{safe(data.stay.dischargeSummary)}</Text>
        </View>
      ) : null}

      <View style={styles.footer} fixed>
        <Text>{labels.confidential}{settings.watermark ? ` — ${labels.restricted}` : ''}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  </Document>
);
