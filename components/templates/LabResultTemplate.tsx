import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    color: '#334155',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
    paddingBottom: 10,
  },
  facilityName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 15,
    backgroundColor: '#f1f5f9',
    padding: 5,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
  },
  infoItem: {
    width: '50%',
    marginBottom: 4,
  },
  label: {
    fontWeight: 'bold',
    color: '#64748b',
    width: 80,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    padding: 6,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 6,
    alignItems: 'center',
  },
  critical: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    fontSize: 7,
    color: '#94a3b8',
  }
});

interface LabResultTemplateProps {
  data: {
    patientName: string;
    patientIpp: string;
    orderId: string;
    dateCollected: string;
    dateReported: string;
    requestingPhysician: string;
    results: Array<{
      testName: string;
      result: string;
      unit: string;
      referenceRange: string;
      isCritical?: boolean;
    }>;
    interpretation?: string;
  };
  facility: any;
  settings: any;
  labels: any;
}

export const LabResultTemplate = ({ data, facility, settings, labels }: LabResultTemplateProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.facilityName}>{facility.name}</Text>
          <Text>{facility.department || 'Laboratory Department'}</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text>{facility.phone}</Text>
          <Text>{facility.email}</Text>
        </View>
      </View>

      <Text style={styles.reportTitle}>{labels.lab_report}</Text>

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}><Text><Text style={styles.label}>{labels.patient}:</Text> {data.patientName}</Text></View>
        <View style={styles.infoItem}><Text><Text style={styles.label}>Order ID:</Text> {data.orderId}</Text></View>
        <View style={styles.infoItem}><Text><Text style={styles.label}>IPP:</Text> {data.patientIpp}</Text></View>
        <View style={styles.infoItem}><Text><Text style={styles.label}>{labels.physician}:</Text> {data.requestingPhysician}</Text></View>
        <View style={styles.infoItem}><Text><Text style={styles.label}>{labels.collected}:</Text> {data.dateCollected}</Text></View>
        <View style={styles.infoItem}><Text><Text style={styles.label}>{labels.reported}:</Text> {data.dateReported}</Text></View>
      </View>

      <View>
        <View style={styles.tableHeader}>
          <View style={{ flex: 3 }}><Text>{labels.test_description}</Text></View>
          <View style={{ flex: 1.5 }}><Text>{labels.result}</Text></View>
          <View style={{ flex: 1 }}><Text>{labels.units}</Text></View>
          <View style={{ flex: 2 }}><Text>{labels.reference_range}</Text></View>
        </View>
        {data.results.map((res, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={{ flex: 3 }}><Text>{res.testName}</Text></View>
            <View style={{ flex: 1.5 }}>
              <Text style={res.isCritical ? styles.critical : {}}>{res.result}</Text>
            </View>
            <View style={{ flex: 1 }}><Text>{res.unit}</Text></View>
            <View style={{ flex: 2 }}><Text>{res.referenceRange}</Text></View>
          </View>
        ))}
      </View>

      {data.interpretation && (
        <View style={{ marginTop: 20, padding: 10, backgroundColor: '#f8fafc' }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>{labels.interpretation}:</Text>
          <Text>{data.interpretation}</Text>
        </View>
      )}

      <View style={{ marginTop: 40, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ width: 150, borderTopWidth: 1, paddingTop: 5 }}>
          <Text style={{ textAlign: 'center', fontSize: 8 }}>{labels.tech_sig}</Text>
        </View>
        <View style={{ width: 150, borderTopWidth: 1, paddingTop: 5 }}>
          <Text style={{ textAlign: 'center', fontSize: 8 }}>{labels.path_val}</Text>
          {settings.digitalSignature && (
            <Text style={{ textAlign: 'center', fontSize: 7, color: '#10b981', marginTop: 2 }}>{labels.verified}</Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Text>Accredited Laboratory Services | Page 1 of 1</Text>
        {settings.watermark && <Text style={{ color: '#fee2e2', marginTop: 2 }}>{labels.confidential}</Text>}
      </View>
    </Page>
  </Document>
);
