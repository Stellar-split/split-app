'use client';

import { useCallback, useState } from 'react';
import type { Invoice } from '@stellar-split/sdk';
import { formatAmount } from '@stellar-split/sdk';

interface Props {
  invoice: Invoice;
  total: bigint;
}

export default function InvoiceExportButton({ invoice, total }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      // Lazy-load @react-pdf/renderer so it doesn't bloat the initial bundle
      const { pdf, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer');

      const exportedAt = new Date().toLocaleString();

      const styles = StyleSheet.create({
        page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#111' },
        header: { marginBottom: 24 },
        title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
        subtitle: { fontSize: 11, color: '#666' },
        section: { marginBottom: 16 },
        sectionTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#1a1a1a' },
        table: { width: '100%', borderWidth: 1, borderColor: '#ddd' },
        tableHeader: {
          flexDirection: 'row',
          backgroundColor: '#4f46e5',
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
              <Text style={styles.title}>✦ StellarSplit</Text>
              <Text style={styles.subtitle}>Invoice Export</Text>
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
  }, [invoice, total]);

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
