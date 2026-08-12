import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { PdfFacility, PdfLabels, PdfSettings } from './types';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    color: '#334155',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 20,
  },
  facilityName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 30,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
    backgroundColor: '#f1f5f9',
    padding: 5,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    width: 120,
    fontWeight: 'bold',
    color: '#64748b',
  },
  value: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  }
});

export interface PatientFileData {
  patient: {
    ipp: string;
    fullName: string;
    dob: string;
    gender: string;
    phone: string;
    address: string;
    bloodGroup?: string;
    allergies?: string[];
    chronicConditions?: string[];
  };
  medicalSummary: string;
  recentVisits: Array<{
    date: string;
    type: string;
    reason: string;
    doctor: string;
  }>;
}

interface PatientFileTemplateProps {
  data: PatientFileData;
  facility: PdfFacility;
  settings: PdfSettings;
  labels: PdfLabels;
}

export const PatientFileTemplate = ({ data, facility, settings, labels }: PatientFileTemplateProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.facilityName}>{facility.name}</Text>
          <Text>Medical Records Department</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text>IPP: {data.patient.ipp}</Text>
          <Text>{labels.reported}: {new Date().toLocaleDateString()}</Text>
        </View>
      </View>

      <Text style={styles.mainTitle}>{labels.patient_file}</Text>

      {/* Demographics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. {labels.identification}</Text>
        <View style={styles.row}><Text style={styles.label}>{labels.full_name}:</Text><Text style={styles.value}>{data.patient.fullName}</Text></View>
        <View style={styles.row}><Text style={styles.label}>{labels.date}:</Text><Text style={styles.value}>{data.patient.dob}</Text></View>
        <View style={styles.row}><Text style={styles.label}>{labels.gender}:</Text><Text style={styles.value}>{data.patient.gender}</Text></View>
        <View style={styles.row}><Text style={styles.label}>{labels.blood_group}:</Text><Text style={styles.value}>{data.patient.bloodGroup || 'Not Documented'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Phone:</Text><Text style={styles.value}>{data.patient.phone}</Text></View>
        <View style={styles.row}><Text style={styles.label}>{labels.address}:</Text><Text style={styles.value}>{data.patient.address}</Text></View>
      </View>

      {/* Critical Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. {labels.alerts}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{labels.allergies}:</Text>
          <Text style={[styles.value, { color: (data.patient.allergies?.length || 0) > 0 ? '#ef4444' : '#334155' }]}>
            {data.patient.allergies?.join(', ') || 'No known allergies'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{labels.chronic_conditions}:</Text>
          <Text style={styles.value}>{data.patient.chronicConditions?.join(', ') || 'None documented'}</Text>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. {labels.medical_history}</Text>
        <Text style={{ lineHeight: 1.5 }}>{data.medicalSummary}</Text>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. {labels.recent_activity}</Text>
        {data.recentVisits.map((visit, i) => (
          <View key={i} style={{ marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontWeight: 'bold' }}>{visit.date} - {visit.type}</Text>
              <Text style={{ fontSize: 9, color: '#64748b' }}>{visit.doctor}</Text>
            </View>
            <Text style={{ fontSize: 9 }}>{labels.reason}: {visit.reason}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text>Electronic Medical Record | {labels.confidential}</Text>
        {settings.watermark && <Text style={{ color: '#fee2e2', marginTop: 2 }}>RESTRICTED MEDICAL DOCUMENT</Text>}
      </View>
    </Page>
  </Document>
);
