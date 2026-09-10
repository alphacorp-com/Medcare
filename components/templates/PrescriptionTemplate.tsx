import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: '#334155',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 15,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  facilityInfo: {
    textAlign: 'right',
  },
  facilityName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  docTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  patientBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 4,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  medicationRow: {
    marginBottom: 15,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
  },
  medName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  medInstructions: {
    fontSize: 9,
    color: '#64748b',
    fontStyle: 'italic',
  },
  signatureArea: {
    marginTop: 50,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  signatureBox: {
    width: 150,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 7,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  }
});

interface PrescriptionTemplateProps {
  data: {
    patientName: string;
    patientAge: string;
    patientGender: string;
    date: string;
    prescriptionId: string;
    doctorName: string;
    doctorSpecialty: string;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string;
    }>;
  };
  facility: any;
  settings: any;
  labels: any;
}

export const PrescriptionTemplate = ({ data, facility, settings, labels }: PrescriptionTemplateProps) => (
  <Document>
    <Page size="A5" orientation="portrait" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {settings.showLogo && facility.logoUrl && <Image src={facility.logoUrl} style={styles.logoContainer} />}
          <Text style={styles.facilityName}>{facility.name}</Text>
          <Text style={{ fontSize: 8 }}>{facility.address}</Text>
        </View>
        <View style={styles.facilityInfo}>
          <Text style={{ fontWeight: 'bold' }}>{data.doctorName}</Text>
          <Text style={{ fontSize: 8 }}>{data.doctorSpecialty}</Text>
          <Text style={{ fontSize: 8 }}>{labels.date}: {data.date}</Text>
        </View>
      </View>

      <Text style={styles.docTitle}>{labels.prescription}</Text>

      {/* Patient Info */}
      <View style={styles.patientBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text>{labels.patient}: <Text style={{ fontWeight: 'bold' }}>{data.patientName}</Text></Text>
          <Text>{labels.age}: {data.patientAge} | {data.patientGender}</Text>
        </View>
        <Text style={{ marginTop: 4, fontSize: 8, color: '#64748b' }}>ID: {data.prescriptionId}</Text>
      </View>

      {/* Medications */}
      <View style={{ flex: 1 }}>
        {data.medications.map((med, i) => (
          <View key={i} style={styles.medicationRow}>
            <Text style={styles.medName}>{i + 1}. {med.name} ({med.dosage})</Text>
            <Text style={styles.medInstructions}>
              {med.frequency} {labels.duration} {med.duration}
            </Text>
            <Text style={{ fontSize: 8, marginTop: 2 }}>{med.instructions}</Text>
          </View>
        ))}
      </View>

      {/* Signature */}
      <View style={styles.signatureArea}>
        <View style={styles.signatureBox}>
          {settings.digitalSignature && (
            <Text style={{ fontSize: 8, color: '#94a3b8', marginBottom: 2 }}>{labels.digitally_signed}</Text>
          )}
          <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{data.doctorName}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>This document is a valid medical prescription. {facility.phone}</Text>
        {settings.watermark && (
          <Text style={{ marginTop: 2, color: '#fca5a5', fontSize: 6 }}>OFFICIAL MEDICAL RECORD</Text>
        )}
      </View>
    </Page>
  </Document>
);
