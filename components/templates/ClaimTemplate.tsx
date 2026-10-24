import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { PdfClaimData, PdfFacility, PdfSettings } from './types';

// Claim to a payer ("bordereau"): one line per invoice, totals, signatures. Landscape A4 — the
// table is wide. Labels come translated in the data (lib/coverage, billing/claims/[id]).

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, color: '#334155', fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8, marginBottom: 10 },
  facility: { fontSize: 11, fontWeight: 'bold', color: '#0f172a' },
  title: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
  meta: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  metaBlock: { flex: 1, padding: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3 },
  metaLabel: { fontSize: 7, color: '#64748b' },
  metaValue: { fontSize: 9, fontWeight: 'bold', color: '#0f172a' },
  thead: { flexDirection: 'row', backgroundColor: '#0f172a', color: '#ffffff', paddingVertical: 4, paddingHorizontal: 3, fontWeight: 'bold' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', paddingVertical: 3, paddingHorizontal: 3 },
  totals: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 3, fontWeight: 'bold', borderTopWidth: 1, borderTopColor: '#0f172a' },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  signatureBox: { width: '40%', borderTopWidth: 0.5, borderTopColor: '#94a3b8', paddingTop: 4, textAlign: 'center', color: '#64748b' },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, textAlign: 'center', fontSize: 6.5, color: '#94a3b8' },
});

// Column widths (sum 100 %).
const COLS = { date: '7%', patient: '17%', ipp: '8%', member: '11%', beneficiary: '13%', authorization: '9%', invoice: '9%', claimed: '9%', paid: '8.5%', rejected: '8.5%' } as const;
const money = (v: number) => Math.round(v).toLocaleString('fr-FR').replace(/ | /g, ' ');

export const ClaimTemplate = ({ data, facility, settings }: { data: PdfClaimData; facility: PdfFacility; settings: PdfSettings }) => {
  const l = data.labels;
  const total = (key: 'invoiceAmount' | 'claimed' | 'paid' | 'rejected') => data.items.reduce((s, i) => s + i[key], 0);
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt */}
            {settings.showLogo && facility.logoUrl ? <Image src={facility.logoUrl} style={{ width: 36, height: 36 }} /> : null}
            <View>
              <Text style={styles.facility}>{facility.name}</Text>
              <Text>{facility.address}</Text>
              <Text>{[facility.phone, facility.email].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={styles.title}>{l.title}</Text>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{data.number}</Text>
            <Text>{l.status}: {data.status}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaBlock}><Text style={styles.metaLabel}>{l.payer}</Text><Text style={styles.metaValue}>{data.payerName}</Text></View>
          <View style={styles.metaBlock}><Text style={styles.metaLabel}>{l.period}</Text><Text style={styles.metaValue}>{data.period}</Text></View>
          <View style={styles.metaBlock}><Text style={styles.metaLabel}>{l.submitted_on}</Text><Text style={styles.metaValue}>{data.submittedOn ?? '—'}</Text></View>
          <View style={styles.metaBlock}><Text style={styles.metaLabel}>{l.invoices}</Text><Text style={styles.metaValue}>{data.items.length}</Text></View>
        </View>

        <View style={styles.thead} fixed>
          <Text style={{ width: COLS.date }}>{l.date}</Text>
          <Text style={{ width: COLS.patient }}>{l.patient}</Text>
          <Text style={{ width: COLS.ipp }}>IPP</Text>
          <Text style={{ width: COLS.member }}>{l.member}</Text>
          <Text style={{ width: COLS.beneficiary }}>{l.beneficiary}</Text>
          <Text style={{ width: COLS.authorization }}>{l.authorization}</Text>
          <Text style={{ width: COLS.invoice, textAlign: 'right' }}>{l.invoice_amount}</Text>
          <Text style={{ width: COLS.claimed, textAlign: 'right' }}>{l.claimed}</Text>
          <Text style={{ width: COLS.paid, textAlign: 'right' }}>{l.paid}</Text>
          <Text style={{ width: COLS.rejected, textAlign: 'right' }}>{l.rejected}</Text>
        </View>
        {data.items.map((i, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <Text style={{ width: COLS.date }}>{i.date}</Text>
            <Text style={{ width: COLS.patient }}>{i.patient}</Text>
            <Text style={{ width: COLS.ipp }}>{i.ipp}</Text>
            <Text style={{ width: COLS.member }}>{i.memberNumber}</Text>
            <Text style={{ width: COLS.beneficiary }}>{i.beneficiary}</Text>
            <Text style={{ width: COLS.authorization }}>{i.authorization ?? '—'}</Text>
            <Text style={{ width: COLS.invoice, textAlign: 'right' }}>{money(i.invoiceAmount)}</Text>
            <Text style={{ width: COLS.claimed, textAlign: 'right' }}>{money(i.claimed)}</Text>
            <Text style={{ width: COLS.paid, textAlign: 'right' }}>{money(i.paid)}</Text>
            <Text style={{ width: COLS.rejected, textAlign: 'right' }}>{money(i.rejected)}</Text>
          </View>
        ))}
        <View style={styles.totals} wrap={false}>
          <Text style={{ width: '65%' }}>{l.totals} ({data.currency})</Text>
          <Text style={{ width: COLS.invoice, textAlign: 'right' }}>{money(total('invoiceAmount'))}</Text>
          <Text style={{ width: COLS.claimed, textAlign: 'right' }}>{money(total('claimed'))}</Text>
          <Text style={{ width: COLS.paid, textAlign: 'right' }}>{money(total('paid'))}</Text>
          <Text style={{ width: COLS.rejected, textAlign: 'right' }}>{money(total('rejected'))}</Text>
        </View>
        <Text style={{ marginTop: 6, fontWeight: 'bold' }}>{l.outstanding}: {money(total('claimed') - total('paid') - total('rejected'))} {data.currency}</Text>
        {data.notes ? <Text style={{ marginTop: 4, color: '#64748b' }}>{data.notes}</Text> : null}

        <View style={styles.signatures} wrap={false}>
          <Text style={styles.signatureBox}>{l.facility_signature}</Text>
          <Text style={styles.signatureBox}>{l.payer_signature}</Text>
        </View>

        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `${data.number} — ${facility.name} — ${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>
  );
};
