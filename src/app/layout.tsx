import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import NotificationCenter from "@/components/NotificationCenter";
import ErrorBoundary from "@/components/ErrorBoundary";
import OnboardingFlow from "@/components/OnboardingFlow";
import UpgradeBanner from "@/components/UpgradeBanner";

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
        <I18nProvider>
          <header className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-gray-950/80 backdrop-blur border-b border-gray-800 min-w-0">
            <a href="/" className="font-bold text-base sm:text-lg tracking-tight shrink-0 min-h-11 inline-flex items-center">
              StellarSplit
            </a>
            <a
              href="/groups"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-2 min-h-11 inline-flex items-center"
            >
              Groups
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
            <SimulationModeToggle />
            <NotificationCenter />
        </header>
        <SimulationBanner />
        <UpgradeBanner />
        <ErrorBoundary>{children}</ErrorBoundary>
        <OnboardingFlow />
        <RecipientOnboarding />
        <Script id="register-sw" strategy="afterInteractive">
          {`if ("serviceWorker" in navigator) {
            window.addEventListener("load", function () {
              navigator.serviceWorker.register("/sw.js");
            });
          }`}
        </Script>
        </I18nProvider>
      </body>
    </html>
  );
}