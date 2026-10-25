import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { templateTexts, type DocumentTemplateId } from '@/lib/document-templates';
import type { PdfSettings } from './types';

// The facility-edited parts of a document (Settings > Document templates), shared by every
// template so they render the same way everywhere: the title override, an introduction under
// the title, a closing note and the "signature and stamp" block at the end, and the footer line.

const styles = StyleSheet.create({
  intro: { fontSize: 9, color: '#334155', marginBottom: 12, lineHeight: 1.4 },
  closing: { fontSize: 9, color: '#334155', marginTop: 12, lineHeight: 1.4 },
  signature: { marginTop: 24, alignSelf: 'flex-end', width: 180, alignItems: 'center' },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: '#94a3b8', width: '100%', height: 36 },
  signatureLabel: { fontSize: 8, color: '#64748b', marginTop: 4 },
  footerText: { marginTop: 2 },
});

export function templateTitle(settings: PdfSettings, id: DocumentTemplateId, fallback: string): string {
  return templateTexts(settings, id).title || fallback;
}

export function TemplateIntro({ settings, id }: { settings: PdfSettings; id: DocumentTemplateId }) {
  const { intro } = templateTexts(settings, id);
  return intro ? <Text style={styles.intro}>{intro}</Text> : null;
}

// withSignature: false for a document that already has its own signature boxes (claims).
export function TemplateClosing({
  settings,
  id,
  signatureLabel,
  withSignature = true,
}: {
  settings: PdfSettings;
  id: DocumentTemplateId;
  signatureLabel?: string;
  withSignature?: boolean;
}) {
  const { closing } = templateTexts(settings, id);
  return (
    <>
      {closing ? <Text style={styles.closing}>{closing}</Text> : null}
      {withSignature && settings.digitalSignature ? (
        <View style={styles.signature} wrap={false}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>{signatureLabel || 'Signature / Cachet'}</Text>
        </View>
      ) : null}
    </>
  );
}

export function TemplateFooterText({ settings }: { settings: PdfSettings }) {
  return settings.footerText ? <Text style={styles.footerText}>{settings.footerText}</Text> : null;
}
