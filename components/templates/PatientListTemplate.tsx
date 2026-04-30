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
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 10,
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '20%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: '#f8fafc',
    padding: 5,
  },
  tableCol: {
    width: '20%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  tableCellHeader: {
    fontWeight: 'bold',
    fontSize: 8,
  },
  tableCell: {
    fontSize: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
  }
});

interface PatientListTemplateProps {
  data: {
    title: string;
    department: string;
    date: string;
    patients: Array<{
      ipp: string;
      name: string;
      gender: string;
      age: string;
      bed?: string;
      status: string;
    }>;
  };
  facility: any;
  settings: any;
  labels: any;
}

export const PatientListTemplate = ({ data, facility, settings, labels }: PatientListTemplateProps) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={{ fontWeight: 'bold' }}>{facility.name}</Text>
          <Text>{data.department}</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text>{data.date}</Text>
        </View>
      </View>

      <Text style={styles.title}>{data.title}</Text>

      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>IPP</Text></View>
          <View style={[styles.tableColHeader, { width: '25%' }]}><Text style={styles.tableCellHeader}>{labels.full_name}</Text></View>
          <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.tableCellHeader}>{labels.gender}</Text></View>
          <View style={[styles.tableColHeader, { width: '10%' }]}><Text style={styles.tableCellHeader}>{labels.age}</Text></View>
          <View style={[styles.tableColHeader, { width: '15%' }]}><Text style={styles.tableCellHeader}>{labels.location}</Text></View>
          <View style={[styles.tableColHeader, { width: '25%' }]}><Text style={styles.tableCellHeader}>{labels.status}</Text></View>
        </View>
        {data.patients.map((p, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{p.ipp}</Text></View>
            <View style={[styles.tableCol, { width: '25%' }]}><Text style={styles.tableCell}>{p.name}</Text></View>
            <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.tableCell}>{p.gender}</Text></View>
            <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.tableCell}>{p.age}</Text></View>
            <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{p.bed || 'N/A'}</Text></View>
            <View style={[styles.tableCol, { width: '25%' }]}><Text style={styles.tableCell}>{p.status}</Text></View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text>{labels.total_patients}: {data.patients.length} | {labels.generated_by} {new Date().toLocaleString()}</Text>
        {settings.watermark && <Text style={{ color: '#fee2e2', marginTop: 2 }}>{labels.confidential}</Text>}
      </View>
    </Page>
  </Document>
);
