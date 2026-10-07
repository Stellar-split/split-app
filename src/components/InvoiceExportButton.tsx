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
 * Generates a QR code data URL for the given invoice verification URL.
 */
async function generateQrCodeDataUrl(invoiceId: string): Promise<string | null> {
  try {
    const QRCode = (await import('qrcode')).default;
    const verifyUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/verify/${invoiceId}`
        : `https://stellarsplit-dapp.vercel.app/verify/${invoiceId}`;
    return await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 });
  } catch {
    return null;
  }
}

/**
 * Downloads a receipt-style PDF for the invoice (compact, single-page).
 * Useful after payment is confirmed to share a "paid receipt" with the payer.
 */
async function downloadReceiptPdf(invoice: Invoice, total: bigint, brand: BrandSettings | null): Promise<void> {
  const { pdf, Document, Page, Text, View, StyleSheet, Image } = await import('@react-pdf/renderer');

  const accent = brand?.accentColor ?? DEFAULT_ACCENT_COLOR;
  const logoDataUrl = brand?.logoUrl ? await fetchLogoDataUrl(brand.logoUrl) : null;
  const qrCodeDataUrl = await generateQrCodeDataUrl(invoice.id);
  const exportedAt = new Date().toLocaleString();
  const verifyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verify/${invoice.id}`
      : `https://stellarsplit-dapp.vercel.app/verify/${invoice.id}`;

  const styles = StyleSheet.create({
    page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#111', backgroundColor: '#fff' },
    banner: { backgroundColor: accent, padding: '10 16', marginBottom: 18, borderRadius: 4 },
    bannerTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    bannerSubtitle: { fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    logo: { height: 28, width: 'auto', marginBottom: 6, objectFit: 'contain' },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 5 },
    label: { width: 130, color: '#555', fontWeight: 'bold' },
    value: { flex: 1 },
    totalRow: { flexDirection: 'row', paddingVertical: 6, marginTop: 2 },
    totalLabel: { width: 130, fontWeight: 'bold', fontSize: 12 },
    totalValue: { flex: 1, fontWeight: 'bold', fontSize: 12, color: accent },
    divider: { borderBottomWidth: 2, borderColor: '#111', marginVertical: 4 },
    qrRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4 },
    qrImg: { width: 56, height: 56, marginRight: 10 },
    qrText: { flex: 1 },
    qrTitle: { fontSize: 9, fontWeight: 'bold' },
    qrUrl: { fontSize: 7, color: '#666', marginTop: 2 },
    footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 8, color: '#aaa', textAlign: 'center' },
    statusBadge: { fontSize: 9, color: '#fff', backgroundColor: invoice.status === 'Released' ? '#16a34a' : invoice.status === 'Refunded' ? '#6b7280' : '#d97706', padding: '2 6', borderRadius: 10, alignSelf: 'flex-start' },
  });

  const doc = (
    <Document>
      <Page size="A5" style={styles.page}>
        {/* Banner */}
        <View style={styles.banner}>
          {logoDataUrl && <Image src={logoDataUrl} style={styles.logo} />}
          <Text style={styles.bannerTitle}>✦ StellarSplit Receipt</Text>
          <Text style={styles.bannerSubtitle}>
            {brand?.tagline ?? 'On-chain Invoice & Payment Splitting'}
          </Text>
        </View>

        {/* Invoice details */}
        <View style={styles.row}><Text style={styles.label}>Invoice #</Text><Text style={styles.value}>{invoice.id}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Status</Text><Text style={[styles.value, { color: invoice.status === 'Released' ? '#16a34a' : '#d97706' }]}>{invoice.status}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Creator</Text><Text style={styles.value}>{invoice.creator}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Total Amount</Text><Text style={styles.value}>{formatAmount(total)} {invoice.token || 'USDC'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Funded</Text><Text style={styles.value}>{formatAmount(invoice.funded)} {invoice.token || 'USDC'}</Text></View>
        {invoice.deadline > 0 && (
          <View style={styles.row}><Text style={styles.label}>Deadline</Text><Text style={styles.value}>{new Date(invoice.deadline * 1000).toLocaleString()}</Text></View>
        )}

        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Funded</Text>
          <Text style={styles.totalValue}>{formatAmount(invoice.funded)} {invoice.token || 'USDC'}</Text>
        </View>

        {/* QR Code */}
        {qrCodeDataUrl && (
          <View style={styles.qrRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qrCodeDataUrl} style={styles.qrImg} />
            <View style={styles.qrText}>
              <Text style={styles.qrTitle}>Verify On-Chain</Text>
              <Text style={styles.qrUrl}>{verifyUrl}</Text>
            </View>
          </View>
        )}

        <Text style={styles.footer}>Generated {exportedAt} · StellarSplit</Text>
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `receipt-${invoice.id}-${dateStr}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sends a receipt email for the invoice by calling the /api/send-confirmation route.
 */
async function sendReceiptEmail(invoice: Invoice, recipientEmail: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/send-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: invoice.id,
        email: recipientEmail,
        status: invoice.status,
        creatorAddress: invoice.creator,
      }),
    });
    if (res.ok) return { ok: true, message: 'Receipt email sent!' };
    const data = await res.json().catch(() => ({}));
    return { ok: false, message: (data as { error?: string }).error ?? 'Failed to send email.' };
  } catch {
    return { ok: false, message: 'Network error. Please try again.' };
  }
}

export default function InvoiceExportButton({ invoice, total, branding }: Props) {
  const [loading, setLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const resolveBranding = useCallback(async (): Promise<BrandSettings | null> => {
    if (branding) return branding;
    try {
      const res = await fetch(`/api/settings/branding?address=${encodeURIComponent(invoice.creator)}`);
      if (res.ok) return (await res.json()) as BrandSettings;
    } catch {}
    return null;
  }, [branding, invoice.creator]);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      // Lazy-load @react-pdf/renderer so it doesn't bloat the initial bundle
      const { pdf, Document, Page, Text, View, StyleSheet, Image } = await import('@react-pdf/renderer');

      const brand = await resolveBranding();
      const accent = brand?.accentColor ?? DEFAULT_ACCENT_COLOR;
      const logoDataUrl = brand?.logoUrl ? await fetchLogoDataUrl(brand.logoUrl) : null;
      const qrCodeDataUrl = await generateQrCodeDataUrl(invoice.id);
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
        qrSection: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6 },
        qrImage: { width: 64, height: 64, marginRight: 12 },
        qrTextContainer: { flex: 1 },
        qrTitle: { fontSize: 10, fontWeight: 'bold', color: '#1a1a1a' },
        qrSubtitle: { fontSize: 8, color: '#666', marginTop: 3 },
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

            {/* QR Code Verification Section */}
            {qrCodeDataUrl && (
              <View style={styles.qrSection}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={qrCodeDataUrl} style={styles.qrImage} />
                <View style={styles.qrTextContainer}>
                  <Text style={styles.qrTitle}>Public On-Chain Verification</Text>
                  <Text style={styles.qrSubtitle}>
                    Scan this QR code or visit /verify/{invoice.id} to verify this invoice on-chain with payment proof.
                  </Text>
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
      const formattedDate = new Date().toISOString().split('T')[0];
      a.download = `invoice-${invoice.id}-${formattedDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }, [invoice, total, resolveBranding]);

  const handleReceiptDownload = useCallback(async () => {
    setReceiptLoading(true);
    try {
      const brand = await resolveBranding();
      await downloadReceiptPdf(invoice, total, brand);
    } finally {
      setReceiptLoading(false);
    }
  }, [invoice, total, resolveBranding]);

  const handleSendEmail = useCallback(async () => {
    const trimmed = emailValue.trim();
    if (!trimmed) return;
    setEmailLoading(true);
    setEmailStatus(null);
    try {
      const result = await sendReceiptEmail(invoice, trimmed);
      setEmailStatus(result);
      if (result.ok) {
        setShowEmailInput(false);
        setEmailValue('');
      }
    } finally {
      setEmailLoading(false);
    }
  }, [invoice, emailValue]);

  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex flex-wrap items-center gap-2">
        {/* Primary: full invoice export */}
        <button
          type="button"
          onClick={handleExport}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 inline-flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-gray-200"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating…
            </>
          ) : (
            <>↓ Export PDF</>
          )}
        </button>

        {/* Receipt PDF download (compact A5) */}
        <button
          type="button"
          onClick={handleReceiptDownload}
          disabled={receiptLoading}
          title="Download a compact receipt PDF with QR code"
          className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 inline-flex items-center gap-2"
        >
          {receiptLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-indigo-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating…
            </>
          ) : (
            <>🧾 Receipt PDF</>
          )}
        </button>

        {/* Email receipt */}
        <button
          type="button"
          onClick={() => {
            setShowEmailInput((v) => !v);
            setEmailStatus(null);
          }}
          title="Email this receipt"
          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 inline-flex items-center gap-2"
          aria-expanded={showEmailInput}
          aria-controls="email-receipt-panel"
        >
          ✉ Email Receipt
        </button>

        {/* Print */}
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Print invoice"
        >
          Print
        </button>
      </div>

      {/* Email receipt input panel */}
      {showEmailInput && (
        <div
          id="email-receipt-panel"
          className="flex flex-col sm:flex-row gap-2 mt-1 p-3 bg-gray-800 rounded-lg border border-gray-700"
        >
          <input
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Email address for receipt"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendEmail(); }}
          />
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={emailLoading || !emailValue.trim()}
            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {emailLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending…
              </>
            ) : (
              'Send'
            )}
          </button>
        </div>
      )}

      {/* Email status feedback */}
      {emailStatus && (
        <p
          role="status"
          className={`text-xs mt-1 ${emailStatus.ok ? 'text-green-400' : 'text-red-400'}`}
        >
          {emailStatus.message}
        </p>
      )}
    </div>
  );
}

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

      // Generate QR code pointing to public verification page
      let qrCodeDataUrl: string | null = null;
      try {
        const QRCode = (await import('qrcode')).default;
        const verifyUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/verify/${invoice.id}`
          : `https://stellarsplit-dapp.vercel.app/verify/${invoice.id}`;
        qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 });
      } catch {
        // QR code generation failed; export will still succeed without it
      }

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
        qrSection: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6 },
        qrImage: { width: 64, height: 64, marginRight: 12 },
        qrTextContainer: { flex: 1 },
        qrTitle: { fontSize: 10, fontWeight: 'bold', color: '#1a1a1a' },
        qrSubtitle: { fontSize: 8, color: '#666', marginTop: 3 },
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

            {/* QR Code Verification Section */}
            {qrCodeDataUrl && (
              <View style={styles.qrSection}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={qrCodeDataUrl} style={styles.qrImage} />
                <View style={styles.qrTextContainer}>
                  <Text style={styles.qrTitle}>Public On-Chain Verification</Text>
                  <Text style={styles.qrSubtitle}>
                    Scan this QR code or visit /verify/{invoice.id} to verify this invoice on-chain with payment proof.
                  </Text>
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
      const formattedDate = new Date().toISOString().split('T')[0];
      a.download = `invoice-${invoice.id}-${formattedDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }, [invoice, total, branding]);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 inline-flex items-center gap-2"
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-gray-200"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Generating…
          </>
        ) : (
          <>↓ Export PDF</>
        )}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Print invoice"
      >
        Print
      </button>
    </div>
  );
}
