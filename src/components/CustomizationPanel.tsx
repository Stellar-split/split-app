"use client";

import { useEffect, useState } from "react";

interface Customization {
  invoiceId: string;
  title: string;
  message: string;
  accentColor: string;
}

interface Props {
  invoiceId: string;
  onCustomizationChange?: (customization: Customization) => void;
}

/**
 * CustomizationPanel — allows customizing invoice title, message, and accent color.
 * Stores customization in localStorage.
 */
export default function CustomizationPanel({
  invoiceId,
  onCustomizationChange,
}: Props) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [accentColor, setAccentColor] = useState("#4f46e5");

  useEffect(() => {
    const stored = localStorage.getItem(`invoice-customization-${invoiceId}`);
    if (stored) {
      const customization = JSON.parse(stored) as Customization;
      setTitle(customization.title);
      setMessage(customization.message);
      setAccentColor(customization.accentColor);
    }
  }, [invoiceId]);

  const handleSave = () => {
    const customization: Customization = {
      invoiceId,
      title,
      message,
      accentColor,
    };
    localStorage.setItem(
      `invoice-customization-${invoiceId}`,
      JSON.stringify(customization),
    );
    onCustomizationChange?.(customization);
  };

  return (
    <section className="bg-gray-900 rounded-xl p-4 sm:p-5 mb-8">
      <h2 className="text-lg font-semibold mb-4">Customize Invoice</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="invoice-title" className="block text-sm font-medium text-gray-300 mb-1">
            Invoice Title
          </label>
          <input
            id="invoice-title"
            type="text"
            placeholder="e.g., Project Milestone #1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="invoice-message" className="block text-sm font-medium text-gray-300 mb-1">
            Custom Message
          </label>
          <textarea
            id="invoice-message"
            placeholder="Add a custom message for recipients..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div>
          <label htmlFor="accent-color" className="block text-sm font-medium text-gray-300 mb-1">
            Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              id="accent-color"
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-12 h-12 rounded-lg cursor-pointer border border-gray-700"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="flex-1 min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
        >
          Save Customization
        </button>
      </div>
    </section>
  );
}
