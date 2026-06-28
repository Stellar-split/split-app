"use client";

import { formatAmount } from "@stellar-split/sdk";

interface PaymentChannelState {
  invoiceId: string;
  payer: string;
  balance: bigint;
  opened: boolean;
}

interface Props {
  invoiceId: string;
  publicKey: string;
  channelState: PaymentChannelState | null;
  onOpen: () => Promise<void>;
  onClose: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export default function PaymentChannelPanel({
  channelState,
  onOpen,
  onClose,
  loading,
  error,
}: Props) {
  return (
    <section aria-labelledby="payment-channel-heading" className="mb-8">
      <div className="rounded-3xl border border-gray-700 bg-gray-900 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="payment-channel-heading" className="text-lg font-semibold">
              Payment Channel
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Open a reusable payment channel for this invoice to keep payments fast and reduce fees.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {channelState?.opened ? (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex items-center justify-center min-h-11 px-5 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "Closing…" : "Close Channel"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpen}
                disabled={loading}
                className="inline-flex items-center justify-center min-h-11 px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "Opening…" : "Open Payment Channel"}
              </button>
            )}
          </div>
        </div>

        {channelState?.opened ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-800 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">
                Channel balance
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatAmount(channelState.balance)} USDC
              </p>
            </div>
            <div className="rounded-2xl bg-gray-800 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">
                Status
              </p>
              <p className="mt-2 text-sm text-gray-300">
                {channelState.balance > 0n ? "Open and ready for payments" : "Open with zero balance"}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-gray-800 p-4 text-sm text-gray-400">
            Your payment channel is currently closed. Open it to store prepaid balance for faster payments.
          </div>
        )}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
