import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";
import OnboardingFlow from "@/components/OnboardingFlow";
import UpgradeBanner from "@/components/UpgradeBanner";
import { I18nProvider } from "@/components/I18nProvider";
import SimulationBanner from "@/components/SimulationBanner";
import RecipientOnboarding from "@/components/RecipientOnboarding";
import CommandPalette from "@/components/CommandPalette";
import { SessionLockProvider } from "@/contexts/SessionLockContext";
import { ToastProvider } from "@/contexts/ToastContext";
import InstallBanner from "@/components/InstallBanner";
import QueryProvider from "@/contexts/QueryProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const themeBootstrap = `
(function () {
  try {
    var stored = window.localStorage.getItem("theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = stored === "dark" || (!stored && prefersDark) || (stored === "system" && prefersDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();
`;

const accessibilityBootstrap = `
(function () {
  try {
    var stored = window.localStorage.getItem("accessibility-settings");
    var settings = stored ? JSON.parse(stored) : {};
    var fontScale = [100, 115, 130].indexOf(settings.fontScale) >= 0 ? settings.fontScale : 100;
    var highContrast = settings.highContrast === "high" ? "high" : "normal";
    var root = document.documentElement;

    root.style.setProperty("--font-scale", String(fontScale / 100));
    root.setAttribute("data-contrast", highContrast);

    if (settings.reducedMotion === true) {
      root.setAttribute("data-reduced-motion", "true");
    } else {
      root.removeAttribute("data-reduced-motion");
    }
  } catch (error) {}
})();
`;

export const metadata: Metadata = {
  title: "StellarSplit — Split invoices on-chain",
  description:
    "Create on-chain invoices on Stellar where multiple payers each owe a share. USDC auto-routes to recipients when fully funded.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://splitapp-steel.vercel.app")
  ),
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
  openGraph: {
    title: "StellarSplit — Split invoices on-chain",
    description:
      "Create on-chain invoices on Stellar where multiple payers each owe a share. USDC auto-routes to recipients when fully funded.",
    url: "/",
    siteName: "StellarSplit",
    images: [`/icons/icon-192.png`],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "StellarSplit — Split invoices on-chain",
    description:
      "Create on-chain invoices on Stellar where multiple payers each owe a share. USDC auto-routes to recipients when fully funded.",
    images: [`/icons/icon-192.png`],
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
    // dir="ltr" is set here as scaffold; I18nProvider will update it client-side when RTL locales (ar/he) are added
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Script
        id="theme-bootstrap"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: themeBootstrap }}
      />
      <Script
        id="accessibility-bootstrap"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: accessibilityBootstrap }}
      />
      <body className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased overflow-x-hidden">
        <QueryProvider>
          <ThemeProvider>
            <AccessibilityProvider>
              <I18nProvider>
                <SessionLockProvider>
                  <ToastProvider>
                    <Navbar />
                    <SimulationBanner />
                    <UpgradeBanner />
                    <ErrorBoundary>{children}</ErrorBoundary>
                    <footer className="border-t border-gray-200 dark:border-gray-800 mt-16 py-6 px-4 sm:px-6">
                      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                        <p className="text-xs text-gray-500">
                          © {new Date().getFullYear()} StellarSplit
                        </p>
                        <LanguageSwitcher />
                      </div>
                    </footer>
                    <CommandPalette />
                    <OnboardingFlow />
                    <RecipientOnboarding />
                    <InstallBanner />
                  </ToastProvider>
                </SessionLockProvider>
              </I18nProvider>
            </AccessibilityProvider>
          </ThemeProvider>
        </QueryProvider>
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
