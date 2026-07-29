"use client";

import { Component, type ReactNode } from "react";
import { classifyRpcError } from "@/lib/errors";
import { backoffDelay } from "@/hooks/useStellarQuery";

const MAX_RETRIES = 3;

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  /** How many retry attempts have failed so far (0 = the initial failure, not yet retried). */
  retriesUsed: number;
  retrying: boolean;
}

/**
 * Catches errors thrown by descendants (e.g. useStellarQuery once it
 * exhausts a fetch) and offers recovery instead of a blank crash. The first
 * failure shows a manual "Retry" button; once clicked, subsequent failures
 * auto-retry with exponential backoff (1s, 2s, 4s, … capped at 30s) up to
 * MAX_RETRIES, after which it gives up with a "check your connection"
 * message.
 */
export default class StellarErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retriesUsed: 0, retrying: false };
  private timer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);

    if (this.state.retriesUsed === 0) {
      // First failure — wait for the user to click Retry.
      return;
    }

    // A retry itself failed — auto-continue the backoff chain without
    // requiring another click, as long as we haven't hit the cap.
    if (this.state.retriesUsed <= MAX_RETRIES) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleRetry = () => {
    const delay = backoffDelay(this.state.retriesUsed - 1);
    this.setState({ retrying: true });
    this.timer = setTimeout(() => {
      this.setState((prev) => ({
        error: null,
        retrying: false,
        retriesUsed: prev.retriesUsed + 1,
      }));
    }, delay);
  };

  private handleRetryClick = () => {
    this.scheduleRetry();
  };

  render() {
    const { error, retriesUsed, retrying } = this.state;

    if (!error) {
      return this.props.children;
    }

    if (retriesUsed >= MAX_RETRIES) {
      return (
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-center flex flex-col items-center gap-3">
          <h3 className="font-semibold text-gray-200">Check your connection</h3>
          <p className="text-gray-400 text-sm">
            We couldn&apos;t reach the Stellar network after several attempts.
            Please check your connection and try again shortly.
          </p>
          <a
            href="https://status.stellar.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2"
          >
            Stellar network status
          </a>
        </div>
      );
    }

    const { kind, message } = classifyRpcError(error);

    return (
      <div role="alert" className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-center flex flex-col items-center gap-3">
        <h3 className="font-semibold text-gray-200">
          {kind === "contract" ? "Transaction failed" : "Connection problem"}
        </h3>
        <p className="text-gray-400 text-sm">{message}</p>
        <button
          type="button"
          onClick={this.handleRetryClick}
          disabled={retrying}
          className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }
}
