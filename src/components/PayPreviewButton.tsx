"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFreighterPublicKey } from "@/lib/freighter";

interface Props {
  invoiceId: string;
  status: string;
}

/**
 * PayPreviewButton — shown on the public preview page.
 * If wallet is connected it navigates to the pay page;
 * otherwise it prompts the user to connect Freighter first.
 */
export default function PayPreviewButton({ invoiceId, status }: Props) {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFreighterPublicKey().then(setPublicKey).catch(() => null);
  }, []);

  if (status !== "Pending") {
    return (
      <p className="text-sm text-gray-400 mt-6 text-center">
        This invoice is {status.toLowerCase()} and no longer accepts payments.
      </p>
    );
  }

  const handleClick = async () => {
    if (publicKey) {
      router.push(`/pay/${invoiceId}`);
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const key = await getFreighterPublicKey();
      setPublicKey(key);
      router.push(`/pay/${invoiceId}`);
    } catch {
      setError("Could not connect wallet. Please install the Freighter extension.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={connecting}
        className="w-full max-w-sm min-h-12 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-base transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {connecting ? "Connecting wallet…" : "Pay This Invoice"}
      </button>
      {!publicKey && !connecting && (
        <p className="text-xs text-gray-400">Requires Freighter wallet extension</p>
      )}
      {error && (
        <p role="alert" className="text-red-400 text-sm text-center">
          {error}
        </p>
      )}
    </div>
  );
}
