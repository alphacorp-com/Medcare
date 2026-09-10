import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

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
  warningBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 10,
    borderRadius: 4,
  },
  warningTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9a3412',
    marginBottom: 3,
  },
  footer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
  }
});

interface MedicationGuideTemplateProps {
  data: {
    medicationName: string;
    dosage: string;
    patientName: string;
    instructions: string;
    frequency: string;
    timing: string;
    warnings: string[];
    sideEffects: string[];
  };
  facility: any;
  settings: any;
  labels: any;
}

export const MedicationGuideTemplate = ({ data, facility, settings, labels }: MedicationGuideTemplateProps) => (
  <Document>
    <Page size="A5" orientation="landscape" style={styles.page}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.medicationName} {data.dosage}</Text>
          <Text style={styles.subtitle}>{labels.patient}: {data.patientName} | {labels.department}: {facility.name}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.how_to_take}</Text>
          <Text style={styles.instructionText}>{data.instructions}</Text>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <View>
              <Text style={{ fontSize: 8, color: '#64748b' }}>{labels.frequency}</Text>
              <Text style={{ fontWeight: 'bold' }}>{data.frequency}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 8, color: '#64748b' }}>{labels.best_time}</Text>
              <Text style={{ fontWeight: 'bold' }}>{data.timing}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>{labels.warnings}</Text>
            {data.warnings.map((w, i) => (
              <Text key={i} style={{ fontSize: 8, marginBottom: 2 }}>• {w}</Text>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.side_effects}</Text>
          <Text style={{ fontSize: 9 }}>{data.sideEffects.join(', ')}</Text>
        </View>

        <View style={styles.footer}>
          <Text>If symptoms persist or worsen, contact {facility.phone} immediately.</Text>
        </View>
      </View>
    </Page>
  </Document>
);
