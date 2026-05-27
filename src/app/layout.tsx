import type { Metadata } from "next";
import "./globals.css";
import NotificationCenter from "@/components/NotificationCenter";
import WalletConnect from "@/components/WalletConnect";

export const metadata: Metadata = {
  title: "StellarSplit — On-chain Invoice Splitting",
  description:
    "Create on-chain invoices on Stellar where multiple payers each owe a share. USDC auto-routes to recipients when fully funded.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 bg-gray-950/80 backdrop-blur border-b border-gray-800">
          <a href="/" className="font-bold text-lg tracking-tight">
            StellarSplit
          </a>
          <div className="flex items-center gap-2">
            <a
              href="/address-book"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-2 py-1"
            >
              Address Book
            </a>
            <NotificationCenter />
            <WalletConnect />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
