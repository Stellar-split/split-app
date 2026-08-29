'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

interface SecuritySettingsResponse {
  mfaEnabled: boolean;
  mfaConfigured: boolean;
  highValueThreshold: number;
}

interface EnrollmentResponse {
  qrCodeDataUrl?: string;
  otpauthUrl?: string;
}

export default function SecuritySettingsPage() {
  const [settings, setSettings] = useState<SecuritySettingsResponse | null>(null);
  const [threshold, setThreshold] = useState('1000');
  const [enrollment, setEnrollment] = useState<EnrollmentResponse | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('default-user');

  useEffect(() => {
    const stored = localStorage.getItem('stellarsplit_wallet_address') || 'default-user';
    setUserId(stored);

    const load = async () => {
      try {
        const response = await fetch(`/api/settings/mfa?userId=${encodeURIComponent(stored)}`);
        const data = await response.json();
        setSettings(data);
        setThreshold(String(data?.highValueThreshold ?? 1000));
      } catch {
        setMessage('Unable to load security settings.');
      }
    };

    load();
  }, []);

  const refreshSettings = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/mfa?userId=${encodeURIComponent(id)}`);
      const data = await response.json();
      setSettings(data);
      setThreshold(String(data?.highValueThreshold ?? 1000));
    } catch {
      setMessage('Unable to refresh security settings.');
    }
  };

  const handleSaveThreshold = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/settings/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'save-settings', highValueThreshold: Number(threshold) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to save the threshold.');
      }
      setSettings(data);
      setMessage('High-value threshold saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the threshold.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/settings/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'enroll' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to start MFA enrollment.');
      }
      setEnrollment(data);
      setMessage('Scan the QR code with your authenticator app.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start MFA enrollment.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/settings/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'confirm', code }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to confirm MFA enrollment.');
      }
      setEnrollment(null);
      setCode('');
      await refreshSettings(userId);
      setMessage('MFA is now enabled.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to confirm MFA enrollment.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/settings/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'disable', code }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to disable MFA.');
      }
      setCode('');
      await refreshSettings(userId);
      setMessage('MFA was disabled.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to disable MFA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10 text-gray-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-400">Security</p>
            <h1 className="text-3xl font-semibold">Multi-factor authentication</h1>
            <p className="mt-2 text-sm text-gray-400">Require a second factor for high-value invoice releases.</p>
          </div>
          <Link href="/settings" className="text-sm text-indigo-400 hover:text-indigo-300">← Back to settings</Link>
        </div>

        <section className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">High-value threshold</h2>
              <p className="mt-1 text-sm text-gray-400">Payments for invoices at or above this value will require MFA.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                className="w-32 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={handleSaveThreshold}
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Authenticator app</h2>
              <p className="mt-1 text-sm text-gray-400">Enable TOTP verification using Google Authenticator or Authy.</p>
            </div>
            <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-300">
              {settings?.mfaEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
              <p className="text-sm font-medium text-gray-200">Enrollment</p>
              <p className="mt-2 text-sm text-gray-400">Start enrollment to receive a QR code that can be scanned by your authenticator app.</p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={loading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {settings?.mfaEnabled ? 'Reset enrollment' : 'Enable MFA'}
                </button>
                {settings?.mfaEnabled && (
                  <button
                    type="button"
                    onClick={handleDisable}
                    disabled={loading}
                    className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                  >
                    Disable
                  </button>
                )}
              </div>
              {enrollment?.qrCodeDataUrl && (
                <div className="mt-5 rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg bg-white p-3">
                    <Image src={enrollment.qrCodeDataUrl} alt="Authenticator QR code" width={180} height={180} className="h-full w-full rounded-md" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={loading || code.length !== 6}
                    className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Confirm enrollment
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
              <p className="text-sm font-medium text-gray-200">Status</p>
              <p className="mt-2 text-sm text-gray-400">Current threshold: {settings?.highValueThreshold ?? 1000}</p>
              <p className="mt-2 text-sm text-gray-400">Authenticator status: {settings?.mfaEnabled ? 'Enabled and ready' : 'Not configured'}</p>
              {message && <p className="mt-4 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300">{message}</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
