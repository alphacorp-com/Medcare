import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { PdfFacility, PdfLabels, PdfReceiptData, PdfSettings } from './types';

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
    marginBottom: 6,
  },
  label: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  amountBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 6,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 9,
    color: '#15803d',
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#15803d',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 8,
  },
});

interface ReceiptTemplateProps {
  data: PdfReceiptData;
  facility: PdfFacility;
  settings: PdfSettings;
  labels: PdfLabels;
}

export const ReceiptTemplate = ({ data, facility, settings, labels }: ReceiptTemplateProps) => (
  <Document>
    <Page size="A5" style={styles.page}>
      <View style={styles.header}>
        <View>
          {settings.showLogo && facility.logoUrl ? (
            <Image src={facility.logoUrl} style={styles.logoContainer} />
          ) : null}
        </View>
        <View style={styles.facilityInfo}>
          <Text style={styles.facilityName}>{facility.name}</Text>
          <Text>{facility.address}</Text>
          <Text>{facility.phone}</Text>
        </View>
      </View>

      <Text style={styles.docTitle}>{labels.receipt}</Text>

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.label}>{labels.number}</Text>
          <Text>{data.receiptNumber}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.label}>{labels.date}</Text>
          <Text>{data.date}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.label}>{labels.patient}</Text>
          <Text>{data.patientName}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.label}>IPP</Text>
          <Text>{data.patientIpp}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.label}>{labels.invoice}</Text>
          <Text>{data.invoiceNumber}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.label}>{labels.payment_method}</Text>
          <Text>{data.method}</Text>
        </View>
      </View>

      <View style={styles.amountBox}>
        <Text style={styles.amountLabel}>{labels.amount_paid}</Text>
        <Text style={styles.amountValue}>{data.amount.toLocaleString()} {data.currency}</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: 'bold' }}>
          {data.isPaidInFull ? labels.paid_in_full : labels.balance_remaining}
        </Text>
        {!data.isPaidInFull && <Text>{data.balanceAfter.toLocaleString()} {data.currency}</Text>}
      </View>

      <View style={styles.footer}>
        <Text>{labels.generated_by} Medcare HMS | {facility.name} - {new Date().toLocaleDateString()}</Text>
        {settings.watermark && (
          <Text style={{ marginTop: 5, color: '#fca5a5' }}>{labels.confidential}</Text>
        )}
      </View>
    </Page>
  </Document>
);
