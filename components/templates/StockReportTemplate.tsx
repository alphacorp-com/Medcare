import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { PdfFacility, PdfLabels, PdfSettings } from './types';

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
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 8,
  },
  lowStock: {
    backgroundColor: '#fef2f2',
  },
  criticalText: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  }
});

interface StockReportTemplateProps {
  data: {
    title: string;
    category: string;
    date: string;
    stats: {
      totalItems: number;
      outOfStock: number;
      lowStock: number;
    };
    items: Array<{
      code: string;
      name: string;
      category: string;
      stock: number;
      minStock: number;
      unit: string;
    }>;
  };
  facility: PdfFacility;
  settings: PdfSettings;
  labels: PdfLabels;
}

export const StockReportTemplate = ({ data, facility, settings, labels }: StockReportTemplateProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={{ fontWeight: 'bold' }}>{facility.name}</Text>
          <Text>Pharmacy Inventory Services</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text>Report ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</Text>
          <Text>{data.date}</Text>
        </View>
      </View>

      <Text style={styles.title}>{data.title}</Text>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{labels.total_patients.replace('Patients', 'Items')}</Text>
          <Text style={styles.summaryValue}>{data.stats.totalItems}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{labels.low_stock}</Text>
          <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>{data.stats.lowStock}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{labels.out_of_stock}</Text>
          <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{data.stats.outOfStock}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={{ flex: 1.5 }}><Text>Code</Text></View>
          <View style={{ flex: 4 }}><Text>{labels.description}</Text></View>
          <View style={{ flex: 1.5 }}><Text>Stock</Text></View>
          <View style={{ flex: 1.5 }}><Text>{labels.min_level}</Text></View>
          <View style={{ flex: 1.5 }}><Text>{labels.status}</Text></View>
        </View>
        {data.items.map((item, i) => (
          <View key={i} style={[styles.tableRow, item.stock <= item.minStock ? styles.lowStock : {}]}>
            <View style={{ flex: 1.5 }}><Text>{item.code}</Text></View>
            <View style={{ flex: 4 }}><Text>{item.name}</Text></View>
            <View style={{ flex: 1.5 }}><Text>{item.stock} {item.unit}</Text></View>
            <View style={{ flex: 1.5 }}><Text>{item.minStock} {item.unit}</Text></View>
            <View style={{ flex: 1.5 }}>
              <Text style={item.stock === 0 ? styles.criticalText : item.stock <= item.minStock ? { color: '#f59e0b' } : { color: '#10b981' }}>
                {item.stock === 0 ? labels.out_of_stock : item.stock <= item.minStock ? labels.low_stock : labels.optimal}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text>Inventory Management System | {labels.confidential} | Page 1 of 1</Text>
        {settings.watermark && <Text style={{ color: '#fee2e2', marginTop: 2 }}>STRICTLY CONFIDENTIAL</Text>}
      </View>
    </Page>
  </Document>
);
