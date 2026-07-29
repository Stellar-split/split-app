"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import FocusTrap from "@/components/FocusTrap";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
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

  const isActive = (href: string) => pathname === href;

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, triggerRef]);

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

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => {
          onClose();
          triggerRef.current?.focus();
        }}
        className={[
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 lg:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Sidebar panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={[
          "fixed inset-y-0 left-0 z-50 w-72 bg-surface-900 border-r border-white/[0.06] flex flex-col",
          "transition-transform duration-200 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {isOpen && (
          <FocusTrap onClose={() => { onClose(); triggerRef.current?.focus(); }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
              <Link
                href="/"
                onClick={onClose}
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
                onClick={() => { onClose(); triggerRef.current?.focus(); }}
                className="flex items-center justify-center h-9 w-9 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Close navigation menu"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M2 2l14 14M16 2 2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile navigation">
              <ul className="flex flex-col gap-1" role="list">
                {NAV_LINKS.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onClose}
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
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 h-10 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
                >
                  <span aria-hidden="true">+</span> New Invoice
                </Link>
              </div>
            </nav>
          </FocusTrap>
        )}
      </div>
    </>
  );
}
