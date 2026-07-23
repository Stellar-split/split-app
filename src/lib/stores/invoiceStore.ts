import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Invoice } from "@stellar-split/sdk";

interface InvoiceState {
  invoices: Record<string, Invoice>;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface InvoiceActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  upsertInvoice: (invoice: Invoice) => void;
  upsertInvoices: (invoices: Invoice[]) => void;
  removeInvoice: (id: string) => void;
  reset: () => void;
}

const initialState: InvoiceState = {
  invoices: {},
  loading: false,
  error: null,
  lastFetched: null,
};

export const useInvoiceStore = create<InvoiceState & InvoiceActions>()(
  devtools(
    immer((set) => ({
      ...initialState,
      setLoading: (loading) =>
        set((s) => { s.loading = loading; }, false, "invoice/setLoading"),
      setError: (error) =>
        set((s) => { s.error = error; }, false, "invoice/setError"),
      upsertInvoice: (invoice) =>
        set(
          (s) => {
            s.invoices[invoice.id] = invoice;
            s.lastFetched = Date.now();
          },
          false,
          "invoice/upsertInvoice"
        ),
      upsertInvoices: (invoices) =>
        set(
          (s) => {
            for (const inv of invoices) {
              s.invoices[inv.id] = inv;
            }
            s.lastFetched = Date.now();
          },
          false,
          "invoice/upsertInvoices"
        ),
      removeInvoice: (id) =>
        set((s) => { delete s.invoices[id]; }, false, "invoice/removeInvoice"),
      reset: () =>
        set(() => ({ ...initialState }), false, "invoice/reset"),
    })),
    {
      name: "InvoiceStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);
