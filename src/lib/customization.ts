import { useEffect, useState } from "react";

interface Customization {
  invoiceId: string;
  title: string;
  message: string;
  accentColor: string;
}

/**
 * Hook to load invoice customization from localStorage.
 */
export function useInvoiceCustomization(invoiceId: string): Customization | null {
  const [customization, setCustomization] = useState<Customization | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`invoice-customization-${invoiceId}`);
    if (stored) {
      setCustomization(JSON.parse(stored) as Customization);
    }
  }, [invoiceId]);

  return customization;
}
