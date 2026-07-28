"use client";

import { useI18n } from "@/components/I18nProvider";
import type { Locale } from "@/lib/i18nTypes";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="text-sm text-gray-400 hover:text-gray-200 px-2 py-1 rounded bg-gray-900 border border-gray-800 transition-colors min-h-11 inline-flex items-center"
      aria-label="Select language"
    >
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="pt">Português</option>
      <option value="fr">Français</option>
    </select>
  );
}
