"use client";

import Link from "next/link";
import DashboardWidgetsBuilder from "@/components/DashboardWidgetsBuilder";

export default function DashboardWidgetsBuilderPage() {
  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-16">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <ol className="flex items-center gap-1.5 text-gray-400">
          <li>
            <Link href="/settings" className="hover:text-white transition-colors">
              Settings
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-600">
            /
          </li>
          <li className="text-white font-medium" aria-current="page">
            Widgets
          </li>
        </ol>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Dashboard Widgets Builder
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Personalise your dashboard by selecting which widgets to display, setting
          their size, and arranging them in the order that matters most to you.
          Changes are saved locally and take effect on your next dashboard visit.
        </p>
      </header>

      <DashboardWidgetsBuilder />

      <div className="mt-8 pt-6 border-t border-gray-800 flex justify-between items-center">
        <Link
          href="/settings"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to Settings
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View dashboard →
        </Link>
      </div>
    </main>
  );
}
