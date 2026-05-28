"use client";

import { useInvoiceCustomization } from "@/lib/customization";

interface Props {
  invoiceId: string;
}

/**
 * CustomizationDisplay — client component to display customization on verify page.
 */
export default function CustomizationDisplay({ invoiceId }: Props) {
  const customization = useInvoiceCustomization(invoiceId);

  if (!customization?.message) return null;

  return (
    <section className="mb-8 p-4 rounded-lg border-l-4" style={{ borderColor: customization.accentColor, backgroundColor: `${customization.accentColor}15` }}>
      <p className="text-sm text-gray-300 whitespace-pre-wrap">{customization.message}</p>
    </section>
  );
}
