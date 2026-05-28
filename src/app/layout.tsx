import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import NotificationCenter from "@/components/NotificationCenter";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "StellarSplit — On-chain Invoice Splitting",
  description:
    "Create on-chain invoices on Stellar where multiple payers each owe a share. USDC auto-routes to recipients when fully funded.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StellarSplit",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased overflow-x-hidden">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-gray-950/80 backdrop-blur border-b border-gray-800 min-w-0">
          <a href="/" className="font-bold text-base sm:text-lg tracking-tight shrink-0 min-h-11 inline-flex items-center">
            StellarSplit
          </a>
          <nav className="flex items-center gap-1 sm:gap-2 min-w-0 flex-wrap justify-end">
            <a
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-2 min-h-11 inline-flex items-center"
            >
              Dashboard
            </a>
            <a
              href="/recipient"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-2 min-h-11 inline-flex items-center whitespace-nowrap"
            >
              <span className="sm:hidden">Recipient</span>
              <span className="hidden sm:inline">Recipient Invoices</span>
            </a>
            <a
              href="/address-book"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-2 min-h-11 inline-flex items-center whitespace-nowrap"
            >
              <span className="sm:hidden">Contacts</span>
              <span className="hidden sm:inline">Address Book</span>
            </a>
            <a
              href="/leaderboard"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-2 py-1"
            >
              Leaderboard
            </a>
            <NotificationCenter />
          </nav>
        </header>
        <ErrorBoundary>{children}</ErrorBoundary>
        <Script id="register-sw" strategy="afterInteractive">
          {`if ("serviceWorker" in navigator) {
            window.addEventListener("load", function () {
              navigator.serviceWorker.register("/sw.js");
            });
          }`}
        </Script>
      </body>
    </html>
  );
}
