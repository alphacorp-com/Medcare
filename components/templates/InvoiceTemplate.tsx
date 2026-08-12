import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { PdfInvoiceData, PdfLabels } from './types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 20,
  },
  logoContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  facilityInfo: {
    textAlign: 'right',
  },
  facilityName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  col: {
    flex: 1,
  },
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 8,
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
  }
});

interface InvoiceTemplateProps {
  invoice: PdfInvoiceData;
  facility: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
    taxId?: string;
  };
  settings: {
    showLogo: boolean;
    includeQR: boolean;
    digitalSignature: boolean;
    watermark: boolean;
  };
  labels: PdfLabels;
}

export const InvoiceTemplate = ({ invoice, facility, settings, labels }: InvoiceTemplateProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {settings.showLogo && facility.logoUrl ? (
            <Image src={facility.logoUrl} style={styles.logoContainer} />
          ) : (
            <View style={styles.logoContainer}>
              <Text style={{ color: '#cbd5e1' }}>LOGO</Text>
            </View>
          )}
        </View>
        <View style={styles.facilityInfo}>
          <Text style={styles.facilityName}>{facility.name}</Text>
          <Text>{facility.address}</Text>
          <Text>{facility.phone} | {facility.email}</Text>
          {facility.taxId && <Text>Tax ID: {facility.taxId}</Text>}
        </View>
      </View>

      <Text style={styles.invoiceTitle}>{labels.invoice}</Text>

      {/* Info Grid */}
      <View style={styles.grid}>
        <View style={styles.col}>
          <Text style={styles.sectionTitle}>{labels.billed_to}</Text>
          <Text style={{ fontWeight: 'bold' }}>{invoice.patientName}</Text>
          <Text>IPP: {invoice.patientIpp}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.sectionTitle}>{labels.invoice_details}</Text>
          <Text>{labels.number}: {invoice.number}</Text>
          <Text>{labels.date}: {invoice.date}</Text>
          <Text>{labels.status}: {invoice.status}</Text>
        </View>
      </View>

      {/* Table */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={{ flex: 3 }}><Text>{labels.description}</Text></View>
          <View style={{ flex: 1, textAlign: 'right' }}><Text>{labels.qty}</Text></View>
          <View style={{ flex: 1, textAlign: 'right' }}><Text>{labels.amount}</Text></View>
        </View>
        {invoice.items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={{ flex: 3 }}><Text>{item.description}</Text></View>
            <View style={{ flex: 1, textAlign: 'right' }}><Text>{item.quantity}</Text></View>
            <View style={{ flex: 1, textAlign: 'right' }}><Text>{item.amount} XAF</Text></View>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 20, alignItems: 'flex-end' }}>
        <View style={{ width: 150 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text>{labels.subtotal}:</Text>
            <Text>{invoice.subtotal} XAF</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 4, fontWeight: 'bold' }}>
            <Text>{labels.total}:</Text>
            <Text>{invoice.total} XAF</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>{labels.generated_by} Medcare HMS | {facility.name} - {new Date().toLocaleDateString()}</Text>
        {settings.watermark && (
          <Text style={{ marginTop: 5, color: '#fca5a5' }}>{labels.confidential}</Text>
        )}
      </View>
    </Page>
  </Document>
);
