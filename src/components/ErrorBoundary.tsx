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
  sentryEventId: string | null;
  copied: boolean;
}

/** Root error boundary — wraps the entire app. Captures exceptions to Sentry when configured. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, sentryEventId: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  async componentDidCatch(error: Error) {
    console.error(error);
    try {
      // Sentry is only initialised when NEXT_PUBLIC_SENTRY_DSN is set.
      // Dynamic import keeps it out of the production bundle when unconfigured.
      const Sentry = await import("@sentry/nextjs");
      const eventId = Sentry.captureException(error);
      this.setState({ sentryEventId: eventId });
    } catch {
      // Sentry unavailable — continue without it
    }
  }

  private handleRetry = () => {
    this.setState({ error: null, sentryEventId: null, copied: false });
    window.location.reload();
  };

  private handleCopyErrorDetails = async () => {
    const { error } = this.state;
    if (!error) return;

    const errorText = `${error.message}\n${error.stack}`;
    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => {
        this.setState({ copied: false });
      }, 2000);
    } catch {
      console.error('Failed to copy error details');
    }
  };

  render() {
    const { error, sentryEventId } = this.state;
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
                className="min-h-11 inline-flex items-center px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
                className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Retry
              </button>
            </>
          )}

          {kind === "unknown" && (
            <>
              <h1 className="text-xl font-bold">Something went wrong</h1>
              <p className="text-gray-400 text-sm break-words max-w-full">{message}</p>
              {sentryEventId && (
                <p className="text-xs text-gray-500 font-mono">
                  Error ID: {sentryEventId}
                </p>
              )}
              <button
                type="button"
                onClick={this.handleCopyErrorDetails}
                className="min-h-10 px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {this.state.copied ? "Copied!" : "Copy error details"}
              </button>
              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Reload Page
                </button>
                <Link
                  href="/dashboard"
                  className="min-h-11 inline-flex items-center px-6 py-3 rounded-lg border border-gray-600 hover:border-gray-400 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Go to Dashboard
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }
}
