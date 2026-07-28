"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "pwa_install_dismissed_until";
const SUPPRESS_DAYS = 7;
const SHOW_DELAY_MS = 30_000;

export default function InstallBanner() {
  const [prompt, setPrompt] = useState<Event | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() < Number(dismissed)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!prompt) return;
    const id = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(id);
  }, [prompt]);

  const handleInstall = async () => {
    if (!prompt) return;
    const deferredPrompt = prompt as BeforeInstallPromptEvent;
    setVisible(false);
    await deferredPrompt.prompt();
  };

  const handleDismiss = () => {
    setVisible(false);
    const until = Date.now() + SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
  };

  if (!visible) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 flex items-start gap-3 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-4"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white text-lg select-none">
        ✦
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Install StellarSplit</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Add to your home screen for faster access and offline browsing.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleInstall}
            className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
          >
            Install App
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-xs font-medium text-gray-300 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Close install banner"
      >
        ✕
      </button>
    </div>
  );
}

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }
}
