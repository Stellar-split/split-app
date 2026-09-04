"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import SimulationModeToggle from "@/components/SimulationModeToggle";
import NotificationCenter from "@/components/NotificationCenter";
import HeaderShortcutsButton from "@/components/HeaderShortcutsButton";
import NetworkStatus from "@/components/NetworkStatus";
import GlobalSearch from "@/components/GlobalSearch";
import MobileSidebar from "@/components/layout/MobileSidebar";

const NAV_LINKS = [
  { href: "/dashboard",      label: "Dashboard" },
  { href: "/invoice",        label: "Invoices" },
  { href: "/subscriptions",  label: "Subscriptions" },
  { href: "/groups",         label: "Groups" },
  { href: "/address-book",   label: "Contacts" },
  { href: "/recipients",     label: "Recipients" },
  { href: "/leaderboard",    label: "Leaderboard" },
];

export default function Navbar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < 640;
  });
  const pathname = usePathname();
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isActive = (href: string) =>
    href === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (
        !hamburgerRef.current?.contains(target) &&
        !target.closest('[data-testid="mobile-sidebar"]')
      ) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [sidebarOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-surface-900/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 h-14">

          {/* Logo */}
          <Link
            href="/"
            className="mr-4 flex items-center gap-2 shrink-0 group"
            aria-label="StellarSplit home"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand shadow-glow-sm text-white text-sm select-none"
              aria-hidden="true"
            >
              ✦
            </span>
            <span className="font-bold text-base tracking-tight text-white group-hover:text-brand-300 transition-colors">
              StellarSplit
            </span>
          </Link>

          {/* Desktop nav links — visible on lg and wider */}
          <nav className="hidden lg:flex items-center gap-1 flex-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={[
                  "px-3 py-1.5 rounded-md text-small font-medium transition-colors",
                  isActive(href)
                    ? "bg-brand-600/20 text-brand-300"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]",
                ].join(" ")}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right-side actions */}
          <div className="ml-auto flex items-center gap-1">
            <div className="hidden sm:flex items-center gap-2">
              <NetworkStatus />
              <SimulationModeToggle />
              <NotificationCenter />
              <HeaderShortcutsButton />
              <ThemeToggle />
            </div>

            {/* New Invoice CTA — hidden below lg */}
            <Link
              href="/invoice/new"
              className="hidden lg:inline-flex items-center gap-1.5 ml-2 h-8 px-3.5 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-small font-semibold transition-colors shadow-glow-sm"
            >
              <span aria-hidden="true">+</span> New Invoice
            </Link>

            {/* Hamburger button — visible below sm (640px) */}
            {isMobile && (
              <button
                ref={hamburgerRef}
                className="ml-1 flex items-center justify-center h-9 w-9 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors lg:hidden"
                aria-label="Open menu"
                aria-expanded={sidebarOpen}
                aria-controls="mobile-sidebar"
                onClick={() => setSidebarOpen((prev) => !prev)}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Slide-in sidebar for below lg */}
      <MobileSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        triggerRef={hamburgerRef}
      />
    </>
  );
}
