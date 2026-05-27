import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";

/**
 * Landing page — explains StellarSplit and provides a CTA to get started.
 */
export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-20 text-center">
      {/* Hero */}
      <h1 className="text-5xl font-bold tracking-tight mb-4">
        Split invoices on-chain.{" "}
        <span className="text-indigo-600 dark:text-indigo-400">Instantly.</span>
      </h1>
      <p className="max-w-xl text-lg text-gray-600 dark:text-gray-400 mb-10">
        StellarSplit lets you create on-chain invoices on Stellar where multiple
        payers each owe a share. USDC auto-routes to every recipient the moment
        the invoice is fully funded. Missed the deadline? Everyone gets refunded.
      </p>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-4 mb-20">
        <WalletConnect />
        <Link
          href="/invoice/new"
          className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors text-white"
        >
          Create Invoice
        </Link>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl w-full text-left">
        {[
          {
            icon: "🔗",
            title: "On-chain & trustless",
            body: "Every invoice lives on Stellar Soroban. No middlemen, no custody.",
          },
          {
            icon: "⚡",
            title: "Auto-release",
            body: "Funds route to recipients the instant the last share is paid.",
          },
          {
            icon: "🔄",
            title: "Auto-refund",
            body: "If the deadline passes unfunded, every contributor is refunded.",
          },
        ].map((f) => (
          <div key={f.title} className="bg-gray-100 dark:bg-gray-900 rounded-xl p-6">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">{f.title}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{f.body}</p>
          </div>
        ))}
      </div>

      {/* Use cases */}
      <p className="mt-16 text-gray-500 text-sm">
        Use cases: group bills · freelancer team payments · remittances across
        LATAM &amp; Africa
      </p>
    </main>
  );
}
