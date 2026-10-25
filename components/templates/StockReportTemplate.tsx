import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { PdfFacility, PdfLabels, PdfSettings } from './types';
import { TemplateClosing, TemplateFooterText, TemplateIntro, templateTitle } from './TemplateExtras';

// Monthly stock report of the pharmacy (lib/stock/report.ts), as shown in Pharmacy > Monthly
// report: one row per article, all depots together. Column labels come translated with the
// data (stock namespace), like the claim template.

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: 'Helvetica', color: '#334155' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 8, marginBottom: 12 },
  facilityName: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
  title: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 4, textTransform: 'uppercase' },
  subtitle: { fontSize: 9, color: '#64748b', textAlign: 'center', marginBottom: 12 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 6 },
  statLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase' },
  statValue: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
  thead: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 4, fontWeight: 'bold', fontSize: 7, textTransform: 'uppercase' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 3 },
  name: { width: '24%', paddingHorizontal: 3 },
  num: { flex: 1, textAlign: 'right', paddingHorizontal: 3 },
  alert: { color: '#b91c1c', fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 18, left: 28, right: 28, textAlign: 'center', fontSize: 7, color: '#94a3b8' },
});

export interface StockReportPdfData {
  period: string;
  category: string;
  rows: Array<{
    name: string;
    unit: string | null;
    opening: number;
    received: number;
    consumed: number;
    losses: number;
    adjusted: number;
    closing: number;
    cmm: number;
    stockoutDays: number;
    vaccine: { dosesAdministered: number; dosesWasted: number; wastageRate: number | null } | null;
  }>;
  labels: Record<
    | 'title' | 'articles' | 'in_stockout' | 'article' | 'opening' | 'received' | 'consumed' | 'losses' | 'adjusted'
    | 'closing' | 'cmm' | 'stockout_days' | 'doses_given' | 'doses_wasted' | 'wastage' | 'empty',
    string
  >;
}

interface StockReportTemplateProps {
  data: StockReportPdfData;
  facility: PdfFacility;
  settings: PdfSettings;
  labels: PdfLabels;
}

const dash = (n: number) => (n ? String(n) : '—');

export const StockReportTemplate = ({ data, facility, settings, labels }: StockReportTemplateProps) => {
  const l = data.labels;
  const hasVaccines = data.rows.some((r) => r.vaccine);
  const inStockout = data.rows.filter((r) => r.stockoutDays > 0 || r.closing <= 0).length;
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt */}
            {settings.showLogo && facility.logoUrl ? <Image src={facility.logoUrl} style={{ width: 32, height: 32 }} /> : null}
            <View>
              <Text style={styles.facilityName}>{facility.name}</Text>
              <Text>{facility.address}</Text>
            </View>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text>{data.period}</Text>
            <Text>{data.category}</Text>
          </View>
        </View>

        <Text style={styles.title}>{templateTitle(settings, 'stock_reports', l.title)}</Text>
        <Text style={styles.subtitle}>{data.period} — {data.category}</Text>
        <TemplateIntro settings={settings} id="stock_reports" />

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statLabel}>{l.articles}</Text><Text style={styles.statValue}>{data.rows.length}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>{l.in_stockout}</Text><Text style={[styles.statValue, inStockout ? styles.alert : {}]}>{inStockout}</Text></View>
        </View>

        <View style={styles.thead} fixed>
          <Text style={styles.name}>{l.article}</Text>
          <Text style={styles.num}>{l.opening}</Text>
          <Text style={styles.num}>{l.received}</Text>
          <Text style={styles.num}>{l.consumed}</Text>
          <Text style={styles.num}>{l.losses}</Text>
          <Text style={styles.num}>{l.adjusted}</Text>
          <Text style={styles.num}>{l.closing}</Text>
          <Text style={styles.num}>{l.cmm}</Text>
          <Text style={styles.num}>{l.stockout_days}</Text>
          {hasVaccines && (
            <>
              <Text style={styles.num}>{l.doses_given}</Text>
              <Text style={styles.num}>{l.doses_wasted}</Text>
              <Text style={styles.num}>{l.wastage}</Text>
            </>
          )}
        </View>
        {data.rows.length === 0 && <Text style={{ textAlign: 'center', marginTop: 16 }}>{l.empty}</Text>}
        {data.rows.map((r, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.name}>{r.name}{r.unit ? ` (${r.unit})` : ''}</Text>
            <Text style={styles.num}>{r.opening}</Text>
            <Text style={styles.num}>{dash(r.received)}</Text>
            <Text style={styles.num}>{dash(r.consumed)}</Text>
            <Text style={styles.num}>{dash(r.losses)}</Text>
            <Text style={styles.num}>{r.adjusted ? (r.adjusted > 0 ? `+${r.adjusted}` : String(r.adjusted)) : '—'}</Text>
            <Text style={styles.num}>{r.closing}</Text>
            <Text style={styles.num}>{r.cmm}</Text>
            <Text style={[styles.num, r.stockoutDays > 0 ? styles.alert : {}]}>{r.stockoutDays}</Text>
            {hasVaccines && (
              <>
                <Text style={styles.num}>{r.vaccine ? r.vaccine.dosesAdministered : '—'}</Text>
                <Text style={styles.num}>{r.vaccine ? r.vaccine.dosesWasted : '—'}</Text>
                <Text style={styles.num}>{r.vaccine?.wastageRate != null ? `${r.vaccine.wastageRate} %` : '—'}</Text>
              </>
            )}
          </View>
        ))}

        <TemplateClosing settings={settings} id="stock_reports" signatureLabel={labels.signature} />
        <View style={styles.footer} fixed>
          <Text render={({ pageNumber, totalPages }) => `${facility.name} — ${data.period} — ${pageNumber} / ${totalPages}`} />
          <TemplateFooterText settings={settings} />
          {settings.watermark && <Text style={{ color: '#fca5a5', marginTop: 2 }}>{labels.confidential}</Text>}
        </View>
      </Page>
    </Document>
  );
};
