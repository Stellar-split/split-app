'use client';

import { useCallback, useState } from 'react';
import type { Invoice } from '@stellar-split/sdk';
import { formatAmount } from '@stellar-split/sdk';
import { DEFAULT_ACCENT_COLOR, type BrandSettings } from '@/lib/brandSettings';

interface Props {
  invoice: Invoice;
  total: bigint;
  /** Creator branding from /settings/branding; null/undefined = platform default. */
  branding?: BrandSettings | null;
}

/** MIME types react-pdf can rasterize reliably (WebP is not supported). */
const PDF_SAFE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg']);

/**
 * Fetches an image URL and returns it as a data URL that @react-pdf/renderer
 * can embed, or null when the image cannot be inlined (network failure or a
 * format react-pdf cannot decode, e.g. WebP — branding colors/tagline still
 * apply; the export never fails because of the logo).
 */
async function fetchLogoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!PDF_SAFE_IMAGE_TYPES.has(blob.type)) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function InvoiceExportButton({ invoice, total, branding }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      // Lazy-load @react-pdf/renderer so it doesn't bloat the initial bundle
      const { pdf, Document, Page, Text, View, StyleSheet, Image } = await import('@react-pdf/renderer');

      // Resolve branding: prefer the prop handed down from the invoice page,
      // but fall back to fetching the creator's settings so exports triggered
      // elsewhere stay branded.
      let brand = branding ?? null;
      if (!brand) {
        try {
          const res = await fetch(`/api/settings/branding?address=${encodeURIComponent(invoice.creator)}`);
          if (res.ok) brand = (await res.json()) as BrandSettings;
        } catch {
          // default styling
        }
      }

      const accent = brand?.accentColor ?? DEFAULT_ACCENT_COLOR;
      const logoDataUrl = brand?.logoUrl ? await fetchLogoDataUrl(brand.logoUrl) : null;

      const exportedAt = new Date().toLocaleString();

      const styles = StyleSheet.create({
        page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#111' },
        header: { marginBottom: 24 },
        logo: { height: 40, width: 'auto', marginBottom: 8, objectFit: 'contain' },
        title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4, color: accent },
        subtitle: { fontSize: 11, color: '#666' },
        tagline: { fontSize: 11, color: '#444', marginTop: 2, fontStyle: 'italic' },
        section: { marginBottom: 16 },
        sectionTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#1a1a1a' },
        table: { width: '100%', borderWidth: 1, borderColor: '#ddd' },
        tableHeader: {
          flexDirection: 'row',
          backgroundColor: accent,
          color: '#fff',
          padding: '6 8',
          fontWeight: 'bold',
        },
        tableRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#ddd', padding: '5 8' },
        col1: { flex: 3 },
        col2: { flex: 1, textAlign: 'right' },
        meta: { flexDirection: 'row', marginBottom: 4 },
        metaLabel: { width: 120, color: '#555', fontWeight: 'bold' },
        metaValue: { flex: 1 },
        footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 9, color: '#aaa', textAlign: 'center' },
      });

      const doc = (
        <Document>
          <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image node, not an HTML img */}
              {logoDataUrl && <Image src={logoDataUrl} style={styles.logo} />}
              <Text style={styles.title}>✦ StellarSplit</Text>
              <Text style={styles.subtitle}>Invoice Export</Text>
              {brand?.tagline && <Text style={styles.tagline}>{brand.tagline}</Text>}
            </View>

            {/* Invoice meta */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Invoice Details</Text>
              <View style={styles.meta}>
                <Text style={styles.metaLabel}>Invoice ID</Text>
                <Text style={styles.metaValue}>#{invoice.id}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.metaLabel}>Status</Text>
                <Text style={styles.metaValue}>{invoice.status}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.metaLabel}>Creator</Text>
                <Text style={styles.metaValue}>{invoice.creator}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.metaLabel}>Total</Text>
                <Text style={styles.metaValue}>{formatAmount(total)} {invoice.token || 'USDC'}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.metaLabel}>Funded</Text>
                <Text style={styles.metaValue}>{formatAmount(invoice.funded)} {invoice.token || 'USDC'}</Text>
              </View>
              {invoice.deadline > 0 && (
                <View style={styles.meta}>
                  <Text style={styles.metaLabel}>Deadline</Text>
                  <Text style={styles.metaValue}>{new Date(invoice.deadline * 1000).toLocaleString()}</Text>
                </View>
              )}
            </View>

            {/* Recipients */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recipients</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.col1}>Address</Text>
                  <Text style={styles.col2}>Amount</Text>
                </View>
                {invoice.recipients.map((r, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.col1}>{r.address}</Text>
                    <Text style={styles.col2}>{formatAmount(r.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Payment history */}
            {invoice.payments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment History</Text>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.col1}>Payer</Text>
                    <Text style={styles.col2}>Amount</Text>
                  </View>
                  {invoice.payments.map((p, i) => (
                    <View key={i} style={styles.tableRow}>
                      <Text style={styles.col1}>{p.payer}</Text>
                      <Text style={styles.col2}>{formatAmount(p.amount)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Footer */}
            <Text style={styles.footer}>
              Exported {exportedAt} · Generated by StellarSplit
            </Text>
          </Page>
        </Document>
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }, [invoice, total, branding]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {loading ? 'Generating…' : '↓ Export PDF'}
    </button>
  );
}
