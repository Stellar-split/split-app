"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/invoice/new", label: "Create Invoice", icon: "＋" },
  { href: "/history", label: "My Invoices", icon: "📄" },
  { href: "/groups", label: "Groups", icon: "👥" },
  { href: "/address-book", label: "Address Book", icon: "📒" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/settings/accessibility", label: "Settings", icon: "⚙" },
];

function useBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [
    { label: "Home", href: "/" },
  ];
  let path = "";
  for (const seg of segments) {
    path += `/${seg}`;
    const label =
      seg.charAt(0).toUpperCase() +
      seg.slice(1).replace(/-/g, " ").replace(/\[.*\]/, "…");
    crumbs.push({ label, href: path });
  }
  return crumbs;
}

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const breadcrumbs = useBreadcrumbs(pathname);
  const isDetail = breadcrumbs.length > 2;

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-full z-30 bg-gray-900 border-r border-gray-800 transition-all duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="flex items-center justify-between px-3 py-4 border-b border-gray-800 min-h-16">
          {!collapsed && (
            <Link href="/" className="font-bold text-sm tracking-tight text-indigo-400 truncate">
              StellarSplit
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto p-1.5 rounded hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2" aria-label="Sidebar navigation">
          {NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </aside>

      {/* ── Mobile overlay ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 w-56 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 min-h-16">
          <Link href="/" className="font-bold text-sm tracking-tight text-indigo-400">
            StellarSplit
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
            className="p-1.5 rounded hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Mobile sidebar navigation">
          {NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
              collapsed={false}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col transition-all duration-200 ${
          collapsed ? "lg:ml-16" : "lg:ml-56"
        }`}
      >
        {/* Top nav (mobile) */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-gray-950/80 backdrop-blur border-b border-gray-800 lg:hidden min-h-14">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="p-1.5 rounded hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            ☰
          </button>
          <Link href="/" className="font-bold text-sm tracking-tight text-indigo-400">
            StellarSplit
          </Link>
        </header>

        {/* Breadcrumbs (detail pages) */}
        {isDetail && (
          <nav
            aria-label="Breadcrumb"
            className="px-4 lg:px-6 py-2 text-xs text-gray-400 flex items-center gap-1 flex-wrap border-b border-gray-800/50"
          >
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">/</span>}
                {i < breadcrumbs.length - 1 ? (
                  <Link href={crumb.href} className="hover:text-gray-200 transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-gray-200" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-6 pt-6 pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        active
          ? "bg-indigo-600/20 text-indigo-300 font-medium"
          : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
      }`}
    >
      <span className="text-base shrink-0" aria-hidden="true">
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
