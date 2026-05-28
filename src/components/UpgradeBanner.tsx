"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";

const STORAGE_KEY_PREFIX = "stellarsplit-upgrade-dismissed-";

interface UpgradeInfo {
  version: string;
  changelogUrl?: string;
}

export default function UpgradeBanner() {
  const [upgrade, setUpgrade] = useState<UpgradeInfo | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    let cleanup: (() => void) | undefined;

    try {
      cleanup = splitClient.watchContractUpgrade((info: UpgradeInfo) => {
        const key = `${STORAGE_KEY_PREFIX}${info.version}`;
        const dismissed = localStorage.getItem(key) === "true";
        if (!dismissed) {
          setUpgrade(info);
        }
      });
    } catch {
      // watchContractUpgrade not available in this environment — silently skip
    }

    return () => {
      cleanup?.();
    };
  }, []);

  const dismiss = () => {
    if (!upgrade) return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${upgrade.version}`, "true");
    setUpgrade(null);
  };

  if (!mounted || !upgrade) return null;

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
