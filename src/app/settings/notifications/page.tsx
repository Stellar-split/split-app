'use client';

import { useEffect, useState } from 'react';

interface NotificationPreferences {
  paymentReceived: boolean;
  invoiceFunded: boolean;
  deadlineApproaching: boolean;
  invoiceReleased: boolean;
  invoiceRefunded: boolean;
}

const STORAGE_KEY = 'stellarsplit-notification-prefs';

const DEFAULT_PREFS: NotificationPreferences = {
  paymentReceived: true,
  invoiceFunded: true,
  deadlineApproaching: true,
  invoiceReleased: true,
  invoiceRefunded: true,
};

function getPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function setPreferences(prefs: NotificationPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPrefs(getPreferences());
    setMounted(true);
  }, []);

  const handleToggle = (key: keyof NotificationPreferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setPreferences(updated);
  };

  const handleEnableAll = () => {
    const updated = {
      paymentReceived: true,
      invoiceFunded: true,
      deadlineApproaching: true,
      invoiceReleased: true,
      invoiceRefunded: true,
    };
    setPrefs(updated);
    setPreferences(updated);
  };

  const handleDisableAll = () => {
    const updated = {
      paymentReceived: false,
      invoiceFunded: false,
      deadlineApproaching: false,
      invoiceReleased: false,
      invoiceRefunded: false,
    };
    setPrefs(updated);
    setPreferences(updated);
  };

  if (!mounted) {
    return (
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-700 rounded w-1/2" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Notification Preferences</h1>
      <p className="text-gray-400 mb-8">Control which events trigger notifications.</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Payment Received</p>
              <p className="text-sm text-gray-400">Notify when a payment is made to your invoice</p>
            </div>
            <button
              onClick={() => handleToggle('paymentReceived')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs.paymentReceived ? 'bg-indigo-600' : 'bg-gray-700'
              }`}
              role="switch"
              aria-checked={prefs.paymentReceived}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs.paymentReceived ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Invoice Funded</p>
              <p className="text-sm text-gray-400">Notify when an invoice reaches 100% funding</p>
            </div>
            <button
              onClick={() => handleToggle('invoiceFunded')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs.invoiceFunded ? 'bg-indigo-600' : 'bg-gray-700'
              }`}
              role="switch"
              aria-checked={prefs.invoiceFunded}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs.invoiceFunded ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Deadline Approaching</p>
              <p className="text-sm text-gray-400">Notify when an invoice deadline is near</p>
            </div>
            <button
              onClick={() => handleToggle('deadlineApproaching')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs.deadlineApproaching ? 'bg-indigo-600' : 'bg-gray-700'
              }`}
              role="switch"
              aria-checked={prefs.deadlineApproaching}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs.deadlineApproaching ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Invoice Released</p>
              <p className="text-sm text-gray-400">Notify when an invoice is released to recipients</p>
            </div>
            <button
              onClick={() => handleToggle('invoiceReleased')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs.invoiceReleased ? 'bg-indigo-600' : 'bg-gray-700'
              }`}
              role="switch"
              aria-checked={prefs.invoiceReleased}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs.invoiceReleased ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Invoice Refunded</p>
              <p className="text-sm text-gray-400">Notify when an invoice is refunded</p>
            </div>
            <button
              onClick={() => handleToggle('invoiceRefunded')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs.invoiceRefunded ? 'bg-indigo-600' : 'bg-gray-700'
              }`}
              role="switch"
              aria-checked={prefs.invoiceRefunded}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs.invoiceRefunded ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleEnableAll}
          className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded font-medium transition-colors"
        >
          Enable All
        </button>
        <button
          onClick={handleDisableAll}
          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
        >
          Disable All
        </button>
      </div>
    </main>
  );
}
