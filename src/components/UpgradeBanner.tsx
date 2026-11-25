"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";

const DISMISSED_KEY = "split_upgrade_dismissed";

interface UpgradeInfo {
  version: string;
  changelogUrl?: string;
}

export default function UpgradeBanner() {
  const [upgrade, setUpgrade] = useState<UpgradeInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(sessionStorage.getItem(DISMISSED_KEY) === "true");

    let cleanup: (() => void) | undefined;

    try {
      cleanup = (splitClient as any).watchContractUpgrade((info: UpgradeInfo) => {
        setUpgrade(info);
      });
    } catch {
      // watchContractUpgrade not available in this environment — silently skip
    }

    return () => {
      cleanup?.();
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  if (!mounted || !upgrade || dismissed) return null;

  const changelogHref = upgrade.changelogUrl ?? "/changelog";

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-yellow-400 text-yellow-950 px-4 py-2 flex items-center justify-between gap-2 text-sm font-medium flex-wrap"
    >
      <span className="flex-1 min-w-0">
        ⚡ Contract upgraded to{" "}
        <span className="font-bold">v{upgrade.version}</span> —{" "}
        <a
          href={changelogHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-700 rounded"
        >
          see changelog
        </a>
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss upgrade notification"
        className="shrink-0 text-yellow-950 hover:text-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-700 rounded px-1 text-base leading-none"
      >
        ×
      </button>
    </div>
  );
}
