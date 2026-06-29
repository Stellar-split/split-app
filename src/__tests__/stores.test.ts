import { beforeEach, describe, expect, it } from "vitest";
import { useWalletStore } from "@/lib/stores/walletStore";
import { useInvoiceStore } from "@/lib/stores/invoiceStore";
import { useUIStore } from "@/lib/stores/uiStore";
import type { Invoice } from "@stellar-split/sdk";

const mockInvoice: Invoice = {
  id: "1",
  creator: "GABC",
  recipients: [{ address: "GDEF", amount: 10_000_000n }],
  token: "token",
  deadline: 9999999999,
  funded: 0n,
  status: "Pending",
  payments: [],
};

beforeEach(() => {
  useWalletStore.setState({
    address: null,
    walletType: null,
    balance: null,
    balanceLoading: false,
    connecting: false,
    error: null,
  });
  useInvoiceStore.setState({
    invoices: {},
    loading: false,
    error: null,
    lastFetched: null,
  });
  useUIStore.setState({
    toasts: [],
    commandPaletteOpen: false,
    sidebarOpen: false,
    activeModal: null,
  });
});

describe("WalletStore", () => {
  it("connects and disconnects", () => {
    useWalletStore.getState().setConnected("GABC", "freighter");
    expect(useWalletStore.getState().address).toBe("GABC");
    expect(useWalletStore.getState().walletType).toBe("freighter");

    useWalletStore.getState().setDisconnected();
    expect(useWalletStore.getState().address).toBeNull();
  });

  it("sets balance", () => {
    useWalletStore.getState().setBalance(100_000_000n);
    expect(useWalletStore.getState().balance).toBe(100_000_000n);
  });

  it("sets and clears error", () => {
    useWalletStore.getState().setError("oops");
    expect(useWalletStore.getState().error).toBe("oops");
    useWalletStore.getState().setError(null);
    expect(useWalletStore.getState().error).toBeNull();
  });

  it("sets connecting flag", () => {
    useWalletStore.getState().setConnecting(true);
    expect(useWalletStore.getState().connecting).toBe(true);
  });
});

describe("InvoiceStore", () => {
  it("upserts a single invoice", () => {
    useInvoiceStore.getState().upsertInvoice(mockInvoice);
    expect(useInvoiceStore.getState().invoices["1"]).toEqual(mockInvoice);
  });

  it("upserts multiple invoices", () => {
    const inv2 = { ...mockInvoice, id: "2" };
    useInvoiceStore.getState().upsertInvoices([mockInvoice, inv2]);
    expect(Object.keys(useInvoiceStore.getState().invoices)).toHaveLength(2);
  });

  it("removes an invoice", () => {
    useInvoiceStore.getState().upsertInvoice(mockInvoice);
    useInvoiceStore.getState().removeInvoice("1");
    expect(useInvoiceStore.getState().invoices["1"]).toBeUndefined();
  });

  it("resets state", () => {
    useInvoiceStore.getState().upsertInvoice(mockInvoice);
    useInvoiceStore.getState().reset();
    expect(useInvoiceStore.getState().invoices).toEqual({});
  });

  it("tracks loading and error", () => {
    useInvoiceStore.getState().setLoading(true);
    expect(useInvoiceStore.getState().loading).toBe(true);
    useInvoiceStore.getState().setError("fail");
    expect(useInvoiceStore.getState().error).toBe("fail");
  });
});

describe("UIStore", () => {
  it("adds and removes toasts", () => {
    useUIStore.getState().addToast({ id: "t1", message: "Hello", type: "success" });
    expect(useUIStore.getState().toasts).toHaveLength(1);
    useUIStore.getState().removeToast("t1");
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it("toggles command palette", () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it("opens and closes modal", () => {
    useUIStore.getState().openModal("pay-modal");
    expect(useUIStore.getState().activeModal).toBe("pay-modal");
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it("toggles sidebar", () => {
    useUIStore.getState().setSidebarOpen(true);
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });
});
