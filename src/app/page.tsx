"use client";

import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";
import { useI18n } from "@/components/I18nProvider";

const FEATURES = [
  {
    icon: "🔗",
    titleKey: "home.features.onChain.title",
    bodyKey:  "home.features.onChain.description",
  },
  {
    icon: "⚡",
    titleKey: "home.features.autoRelease.title",
    bodyKey:  "home.features.autoRelease.description",
  },
  {
    icon: "🔄",
    titleKey: "home.features.autoRefund.title",
    bodyKey:  "home.features.autoRefund.description",
  },
];

export default function HomePage() {
  const { t } = useI18n();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-full max-w-full px-4 sm:px-6 py-20 text-center overflow-x-hidden">
      {/* Hero */}
      <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
        {t("home.headline")
          .split("Instantly.")
          .map((part, i) =>
            i === 0
              ? part
              : [<span key="instant" className="text-indigo-400">Instantly.</span>, part]
          )}
      </h1>
      <p className="max-w-xl text-lg text-gray-600 dark:text-gray-400 mb-10">
        {t("home.description")}
      </p>

          {/* Sub-headline */}
          <p className="text-body-lg text-slate-400 max-w-xl mb-10">
            {t("home.description")}
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-10">
            <WalletConnect />
            <Link
              href="/invoice/new"
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-semibold transition-colors shadow-glow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <span aria-hidden="true">+</span>
              {t("home.createInvoice")}
            </Link>
          </div>

          {/* Social proof */}
          <p className="text-xs text-slate-500">
            {t("home.useCases")}
          </p>
        </div>
      </section>

      {/* ── Feature grid ──────────────────────────────────────────── */}
      <section
        aria-labelledby="features-heading"
        className="relative px-4 sm:px-6 pb-24"
      >
        <h2 id="features-heading" className="sr-only">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl w-full text-left">
          {features.map((f) => (
            <div key={f.title} className="bg-gray-100 dark:bg-gray-900 rounded-xl p-6">
              <div className="text-3xl mb-3" aria-hidden="true">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <p className="mt-16 text-gray-500 dark:text-gray-500 text-sm">
        {t("home.useCases")}
      </p>
    </main>
  );
}
