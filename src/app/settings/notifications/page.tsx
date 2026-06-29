'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';

const STORAGE_KEY = 'split-notification-prefs';

interface EventPrefs {
  inApp: boolean;
  browser: boolean;
}

interface NotifPrefs {
  paymentReceived: EventPrefs;
  invoiceFunded: EventPrefs;
  refundIssued: EventPrefs;
  disputeRaised: EventPrefs;
  deadlineApproaching: EventPrefs;
}

const DEFAULT_PREFS: NotifPrefs = {
  paymentReceived:    { inApp: true,  browser: false },
  invoiceFunded:      { inApp: true,  browser: false },
  refundIssued:       { inApp: true,  browser: false },
  disputeRaised:      { inApp: true,  browser: false },
  deadlineApproaching:{ inApp: true,  browser: false },
};

const EVENT_LABELS: { key: keyof NotifPrefs; label: string; description: string }[] = [
  { key: 'paymentReceived',    label: 'Payment Received',      description: 'Someone paid toward your invoice' },
  { key: 'invoiceFunded',      label: 'Invoice Funded',        description: 'Invoice reaches 100% funding' },
  { key: 'refundIssued',       label: 'Refund Issued',         description: 'A refund has been issued on an invoice' },
  { key: 'disputeRaised',      label: 'Dispute Raised',        description: 'A dispute was opened on your invoice' },
  { key: 'deadlineApproaching',label: 'Deadline Approaching',  description: '24-hour warning before invoice deadline' },
];

function load(): NotifPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed ${
        on ? 'bg-indigo-600' : 'bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function NotificationPreferencesPage() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    setPrefs(load());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
    setMounted(true);
  }, []);

  const toggle = (key: keyof NotifPrefs, col: 'inApp' | 'browser') => {
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [col]: !prev[key][col] },
    }));
  };

  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setBrowserPermission(result);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    toast.success('Notification preferences saved.');
  };

  const handleReset = () => {
    setPrefs(DEFAULT_PREFS);
  };

  const browserDenied = browserPermission === 'denied';
  const browserGranted = browserPermission === 'granted';

  if (!mounted) {
    return (
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-700 rounded w-2/3" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold mb-1">Notification Preferences</h1>
      <p className="text-gray-400 text-sm mb-6">Choose which events trigger notifications and where.</p>

      {/* Browser permission banner */}
      {!browserGranted && (
        <div className="mb-6 bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-200">Browser (Push) Notifications</p>
            {browserDenied ? (
              <p className="text-xs text-red-400 mt-0.5">
                Permission denied — change in browser settings to enable push notifications.
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                Allow browser notifications to receive alerts even when the app is in the background.
              </p>
            )}
          </div>
          {!browserDenied && (
            <button
              type="button"
              onClick={requestBrowserPermission}
              className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
            >
              Enable Browser Notifications
            </button>
          )}
        </div>
      )}

      {/* Preferences table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_80px_80px] gap-4 px-4 py-3 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span>Event</span>
          <span className="text-center">In-App</span>
          <span className="text-center">Browser</span>
        </div>

        {EVENT_LABELS.map(({ key, label, description }, i) => (
          <div
            key={key}
            className={`grid grid-cols-[1fr_80px_80px] gap-4 items-center px-4 py-4 ${
              i < EVENT_LABELS.length - 1 ? 'border-b border-gray-800' : ''
            }`}
          >
            <div>
              <p className="text-sm font-medium text-gray-100">{label}</p>
              <p className="text-xs text-gray-400">{description}</p>
            </div>
            <div className="flex justify-center">
              <Toggle on={prefs[key].inApp} onChange={() => toggle(key, 'inApp')} />
            </div>
            <div className="flex justify-center">
              <Toggle
                on={prefs[key].browser}
                onChange={() => toggle(key, 'browser')}
                disabled={browserDenied}
              />
            </div>
          </div>
        ))}
      </div>

      {browserDenied && (
        <p className="text-xs text-red-400 mb-4">
          Browser toggles are disabled — notification permission was denied. Update your browser site settings to re-enable.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-sm transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </main>
  );
}
