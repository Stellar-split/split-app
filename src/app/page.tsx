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
        <span className="text-indigo-400">Instantly.</span>
      </h1>
      <p className="max-w-xl text-lg text-gray-400 mb-10">
        StellarSplit lets you create on-chain invoices on Stellar where multiple
        payers each owe a share. USDC auto-routes to every recipient the moment
        the invoice is fully funded. Missed the deadline? Everyone gets refunded.
      </p>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-4 mb-20">
        <WalletConnect />
        <Link
          href="/invoice/new"
          className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          Create Invoice
        </Link>
      </div>

      {/* Feature grid */}
      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl w-full text-left">
          {[
            {
              icon: "🔗",
              iconLabel: "Chain link",
              title: "On-chain & trustless",
              body: "Every invoice lives on Stellar Soroban. No middlemen, no custody.",
            },
            {
              icon: "⚡",
              iconLabel: "Lightning bolt",
              title: "Auto-release",
              body: "Funds route to recipients the instant the last share is paid.",
            },
            {
              icon: "🔄",
              iconLabel: "Refresh arrows",
              title: "Auto-refund",
              body: "If the deadline passes unfunded, every contributor is refunded.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-gray-900 rounded-xl p-6">
              <div className="text-3xl mb-3" aria-hidden="true">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <p className="mt-16 text-gray-500 text-sm">
        Use cases: group bills · freelancer team payments · remittances across
        LATAM &amp; Africa
      </p>
    </main>
  );
}
