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
    <main className="relative overflow-x-hidden">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 sm:px-6 py-20 text-center">

        {/* Ambient radial glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-hero"
        />
        {/* Soft grid overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center max-w-3xl w-full">

          {/* Eyebrow badge */}
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-600/10 px-4 py-1.5 text-xs font-semibold text-brand-300 uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" aria-hidden="true" />
            Built on Stellar · Powered by Soroban
          </span>

          {/* Headline */}
          <h1 className="text-h1 sm:text-display font-bold tracking-tight text-white mb-5 leading-tight">
            {t("home.headline")
              .split("Instantly.")
              .map((part, i) =>
                i === 0
                  ? <span key="pre">{part}</span>
                  : [
                      <span key="instant" className="bg-gradient-brand bg-clip-text text-transparent">
                        Instantly.
                      </span>,
                      <span key="post">{part}</span>,
                    ]
              )}
          </h1>

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

        <div className="mx-auto grid max-w-4xl grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map(({ icon, titleKey, bodyKey }) => (
            <div
              key={titleKey}
              className="group rounded-2xl border border-white/[0.07] bg-surface-800/60 p-6 hover:border-brand-500/30 hover:shadow-glow-sm transition-all"
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600/15 text-2xl"
                aria-hidden="true"
              >
                {icon}
              </div>
              <h3 className="text-h3 text-white mb-2">{t(titleKey)}</h3>
              <p className="text-small text-slate-400">{t(bodyKey)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
