"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";
import { classifyError } from "@/lib/errors";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  private handleRetry = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const { kind, message } = classifyError(error);

    return (
      <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-20 overflow-x-hidden">
        <div className="flex flex-col items-center text-center gap-4">
          {kind === "wallet_not_connected" && (
            <>
              <h1 className="text-xl font-bold">Wallet required</h1>
              <p className="text-gray-400 text-sm">{message}</p>
              <WalletConnect />
            </>
          )}

          {kind === "invoice_not_found" && (
            <>
              <h1 className="text-5xl font-bold text-gray-500">404</h1>
              <p className="text-gray-400 text-sm">{message}</p>
              <Link
                href="/dashboard"
                className="min-h-11 inline-flex items-center px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors"
              >
                Back to Dashboard
              </Link>
            </>
          )}

          {kind === "rpc_timeout" && (
            <>
              <h1 className="text-xl font-bold">Request timed out</h1>
              <p className="text-gray-400 text-sm">{message}</p>
              <button
                type="button"
                onClick={this.handleRetry}
                className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors"
              >
                Retry
              </button>
            </>
          )}

          {kind === "unknown" && (
            <>
              <h1 className="text-xl font-bold">Something went wrong</h1>
              <p className="text-gray-400 text-sm break-words max-w-full">{message}</p>
              <button
                type="button"
                onClick={this.handleRetry}
                className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </main>
    );
  }
}
