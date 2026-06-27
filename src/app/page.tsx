"use client";

import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";
import { useI18n } from "@/components/I18nProvider";

/**
 * Landing page — explains StellarSplit and provides a CTA to get started.
 */
export default function HomePage() {
  const { t } = useI18n();

  const features = [
    {
      icon: "🔗",
      title: t("home.features.onChain.title"),
      body: t("home.features.onChain.description"),
    },
    {
      icon: "⚡",
      title: t("home.features.autoRelease.title"),
      body: t("home.features.autoRelease.description"),
    },
    {
      icon: "🔄",
      title: t("home.features.autoRefund.title"),
      body: t("home.features.autoRefund.description"),
    },
  ];

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

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-4 mb-20">
        <WalletConnect />
        <Link
          href="/invoice/new"
          className="min-h-11 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {t("home.createInvoice")}
        </Link>
      </div>

      {/* Feature grid */}
      <section aria-labelledby="features-heading">
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
