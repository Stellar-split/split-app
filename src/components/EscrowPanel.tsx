"use client";

import { useEffect, useRef, useState } from "react";
import { formatAmount } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  total: bigint;
}

function LockIcon({ released }: { released: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`w-6 h-6 transition-all duration-500 ${
        released ? "text-green-400 -rotate-12" : "text-yellow-400"
      }`}
    >
      {released ? (
        // Unlocked padlock
        <>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </>
      ) : (
        // Locked padlock
        <>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      )}
    </svg>
  );
}

function Check({ ok }: { ok: boolean }) {
  return (
    <span
      className={`text-sm font-bold ${ok ? "text-green-400" : "text-red-400"}`}
      aria-label={ok ? "met" : "not met"}
    >
      {ok ? "✓" : "✗"}
    </span>
  );
}

export default function EscrowPanel({ invoice, total }: Props) {
  const isReleased = invoice.status === "Released";
  const isRefunded = invoice.status === "Refunded";

  const fullyFunded = total > 0n && invoice.funded >= total;
  const hasDispute = !!(
    (invoice as Invoice & { disputeStatus?: { resolved: boolean } }).disputeStatus
      ?.resolved === false
  );
  const deadlinePassed =
    invoice.deadline > 0 && Date.now() / 1000 > invoice.deadline;

  // Animate lock icon when status transitions to Released
  const [animate, setAnimate] = useState(false);
  const prevStatus = useRef(invoice.status);
  useEffect(() => {
    if (prevStatus.current !== "Released" && invoice.status === "Released") {
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(t);
    }
    prevStatus.current = invoice.status;
  }, [invoice.status]);

  if (isRefunded) {
    return (
      <section
        aria-labelledby="escrow-heading"
        className="mb-8 rounded-lg border border-gray-700 bg-gray-900 p-4"
      >
        <div className="flex items-center gap-2 mb-1">
          <LockIcon released />
          <h2 id="escrow-heading" className="text-base font-semibold text-gray-300">
            Escrow
          </h2>
        </div>
        <p className="text-sm text-gray-400">Escrow returned — funds have been refunded.</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="escrow-heading"
      className="mb-8 rounded-lg border border-gray-700 bg-gray-900 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={animate ? "animate-bounce" : undefined}>
          <LockIcon released={isReleased} />
        </span>
        <h2 id="escrow-heading" className="text-base font-semibold">
          Escrow
        </h2>
        <span
          className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
            isReleased
              ? "bg-green-900 text-green-300"
              : "bg-yellow-900 text-yellow-300"
          }`}
        >
          {isReleased ? "Released" : "Locked"}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        <span className="text-white font-semibold">{formatAmount(invoice.funded)} USDC</span>{" "}
        locked in escrow
      </p>

      <ul className="flex flex-col gap-2" aria-label="Release conditions">
        <li className="flex items-center gap-2 text-sm">
          <Check ok={fullyFunded} />
          <span className="text-gray-300">Fully funded</span>
          <span className="ml-auto text-xs text-gray-500">
            {formatAmount(invoice.funded)} / {formatAmount(total)} USDC
          </span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          <Check ok={!hasDispute} />
          <span className="text-gray-300">No active dispute</span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          <Check ok={!deadlinePassed} />
          <span className="text-gray-300">Deadline not passed</span>
          {invoice.deadline > 0 && (
            <span className="ml-auto text-xs text-gray-500">
              {new Date(invoice.deadline * 1000).toLocaleDateString()}
            </span>
          )}
        </li>
      </ul>
    </section>
  );
}
