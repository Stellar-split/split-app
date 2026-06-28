"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import SimulationModeToggle from "@/components/SimulationModeToggle";
import NotificationCenter from "@/components/NotificationCenter";
import HeaderShortcutsButton from "@/components/HeaderShortcutsButton";
import NetworkStatus from "@/components/NetworkStatus";

const NAV_LINKS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/groups",       label: "Groups" },
  { href: "/address-book", label: "Contacts" },
  { href: "/leaderboard",  label: "Leaderboard" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-surface-900/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 h-14">

        {/* Logo */}
        <Link
          href="/"
          className="mr-4 flex items-center gap-2 shrink-0 group"
          aria-label="StellarSplit home"
        >
          {/* Star icon */}
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

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Main navigation">
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

          {/* New Invoice CTA */}
          <Link
            href="/invoice/new"
            className="hidden sm:inline-flex items-center gap-1.5 ml-2 h-8 px-3.5 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-small font-semibold transition-colors shadow-glow-sm"
          >
            <span aria-hidden="true">+</span> New Invoice
          </Link>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden ml-1 flex items-center justify-center h-9 w-9 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 2l14 14M16 2 2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav
          className="md:hidden border-t border-white/[0.06] bg-surface-900 px-4 py-3 flex flex-col gap-1"
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={[
                "px-3 py-2.5 rounded-md text-small font-medium transition-colors",
                isActive(href)
                  ? "bg-brand-600/20 text-brand-300"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.06]",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/invoice/new"
            onClick={() => setMenuOpen(false)}
            className="mt-2 flex items-center justify-center gap-1.5 h-10 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-small font-semibold transition-colors"
          >
            + New Invoice
          </Link>
          <div className="flex items-center gap-1 pt-2 border-t border-white/[0.06] mt-1">
            <SimulationModeToggle />
            <NotificationCenter />
            <HeaderShortcutsButton />
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
