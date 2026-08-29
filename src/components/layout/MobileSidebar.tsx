"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import FocusTrap from "@/components/FocusTrap";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoice", label: "Invoices" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/groups", label: "Groups" },
  { href: "/address-book", label: "Contacts" },
  { href: "/recipients", label: "Recipients" },
  { href: "/leaderboard", label: "Leaderboard" },
];

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

export default function MobileSidebar({ isOpen, onClose, triggerRef }: MobileSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    triggerRef.current?.focus();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className={[
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 lg:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Sidebar panel — always in DOM; CSS transform handles visual show/hide */}
      <div
        role="dialog"
        aria-modal={isOpen ? "true" : undefined}
        aria-label="Navigation menu"
        className={[
          "fixed inset-y-0 left-0 z-50 w-72 bg-surface-900 border-r border-white/[0.06] flex flex-col",
          "transition-transform duration-200 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/*
         * FocusTrap is always mounted but only active when open.
         * active=false prevents focus stealing on page load so the
         * hamburger button can be focused and Enter can trigger its click.
         */}
        <FocusTrap
          active={isOpen}
          onClose={handleClose}
          className="flex flex-col flex-1 min-h-0 outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
            <Link
              href="/"
              onClick={isOpen ? onClose : undefined}
              tabIndex={isOpen ? 0 : -1}
              className="flex items-center gap-2 group"
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
            <button
              onClick={handleClose}
              tabIndex={isOpen ? 0 : -1}
              className="flex items-center justify-center h-9 w-9 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Close navigation menu"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 2l14 14M16 2 2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/*
           * Nav is always in the DOM (never conditionally removed).
           * aria-hidden keeps it out of the accessibility tree while closed so
           * getByRole('navigation') returns 0 results until the sidebar opens.
           * After open: aria-hidden=false, sidebar at translate-x-0 (in viewport),
           * so getByRole finds it and toBeVisible() passes.
           */}
          <nav
            className="flex-1 overflow-y-auto px-3 py-4"
            aria-label="Mobile navigation"
            aria-hidden={!isOpen}
          >
            <ul className="flex flex-col gap-1" role="list">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={isOpen ? onClose : undefined}
                    tabIndex={isOpen ? 0 : -1}
                    className={[
                      "block px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      isActive(href)
                        ? "bg-brand-600/20 text-brand-300"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <Link
                href="/invoice/new"
                onClick={isOpen ? onClose : undefined}
                tabIndex={isOpen ? 0 : -1}
                className="flex items-center justify-center gap-1.5 h-10 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
              >
                <span aria-hidden="true">+</span> New Invoice
              </Link>
            </div>
          </nav>
        </FocusTrap>
      </div>
    </>
  );
}
