import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { PdfFacility, PdfLabels, PdfSettings } from './types';
import { TemplateClosing, TemplateFooterText, TemplateIntro, templateTitle } from './TemplateExtras';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    color: '#334155',
    fontFamily: 'Helvetica',
  },
  card: {
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingBottom: 10,
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1d4ed8',
  },
  subtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    textAlign: 'center',
  },
  footer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
  }
});

// Patient sheet of a prescription: how to take each drug, as the prescriber wrote it. Built
// only from the prescription lines — MedCare holds no drug monograph, so no warning or side
// effect is ever printed that a clinician did not write.
export interface MedicationGuideData {
  patientName: string;
  prescriber: string;
  date: string;
  medications: { name: string; dosage: string; frequency: string; duration: string; instructions: string }[];
}

interface MedicationGuideTemplateProps {
  data: MedicationGuideData;
  facility: PdfFacility;
  settings: PdfSettings;
  labels: PdfLabels;
}

export const MedicationGuideTemplate = ({ data, facility, settings, labels }: MedicationGuideTemplateProps) => (
  <Document>
    <Page size="A5" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{templateTitle(settings, 'medications', labels.medication_guide)}</Text>
        <Text style={styles.subtitle}>
          {labels.patient}: {data.patientName} | {labels.doctor}: {data.prescriber} | {data.date} | {facility.name}
        </Text>
      </View>
      <TemplateIntro settings={settings} id="medications" />

      {data.medications.map((med, i) => (
        <View key={i} style={styles.card} wrap={false}>
          <Text style={styles.sectionTitle}>{med.name}</Text>
          <View style={{ flexDirection: 'row', gap: 20, marginBottom: med.instructions ? 6 : 0 }}>
            {[
              [labels.dosage, med.dosage],
              [labels.frequency, med.frequency],
              [labels.duration, med.duration],
            ].map(([label, value]) => (
              <View key={label}>
                <Text style={{ fontSize: 8, color: '#64748b' }}>{label}</Text>
                <Text style={{ fontWeight: 'bold' }}>{value || '—'}</Text>
              </View>
            ))}
          </View>
          {med.instructions ? <Text style={styles.instructionText}>{med.instructions}</Text> : null}
        </View>
      ))}

      <TemplateClosing settings={settings} id="medications" signatureLabel={labels.signature} />
      <View style={styles.footer}>
        <Text>{facility.phone}</Text>
        <TemplateFooterText settings={settings} />
        {settings.watermark && (
          <Text style={{ marginTop: 5, color: '#fca5a5' }}>{labels.confidential}</Text>
        )}
      </View>
    </Page>
  </Document>
);
