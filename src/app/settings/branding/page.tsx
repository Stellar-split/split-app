"use client";

import InvoiceBrandingSettings from "@/components/InvoiceBrandingSettings";

export default function BrandingSettingsPage() {
  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Invoice branding</h1>
      <p className="text-sm text-gray-500 mb-8">
        Customize how your invoices look with a logo, accent color, font and watermark.
        These preferences apply to invoice previews and exported PDFs.
      </p>
      <InvoiceBrandingSettings />
    </main>
  );
}
