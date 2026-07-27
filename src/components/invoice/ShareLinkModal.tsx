'use client';

import { useCallback, useEffect, useState } from 'react';
import FocusTrap from '@/components/FocusTrap';
import { formatShareLinkDuration } from '@/lib/shareLink';
import type { ShareLinkPermission } from '@/lib/shareLink';

interface ActiveShareLink {
  tokenHash: string;
  permissions: ShareLinkPermission;
  expiresAt: string;
  maxUses?: number;
  usesConsumed: number;
  createdAt: string;
}

interface ShareLinkModalProps {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: '1 hour', ms: 3600000 },
  { label: '24 hours', ms: 86400000 },
  { label: '7 days', ms: 604800000 },
  { label: '30 days', ms: 2592000000 },
] as const;

export default function ShareLinkModal({
  open,
  invoiceId,
  onClose,
}: ShareLinkModalProps) {
  const [selectedDuration, setSelectedDuration] = useState(3600000);
  const [selectedPermission, setSelectedPermission] = useState<ShareLinkPermission>('read');
  const [singleUse, setSingleUse] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [activeLinks, setActiveLinks] = useState<ActiveShareLink[]>([]);
  const [copied, setCopied] = useState(false);

  // Fetch active links
  const fetchActiveLinks = useCallback(async () => {
    try {
      const response = await fetch(`/api/invoices/share-links?invoiceId=${invoiceId}`);
      if (response.ok) {
        const data = await response.json();
        setActiveLinks(data.links || []);
      }
    } catch (err) {
      console.error('Failed to fetch share links:', err);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (open) {
      fetchActiveLinks();
    }
  }, [open, fetchActiveLinks]);

  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);
    setGeneratedLink(null);

    try {
      const response = await fetch('/api/invoices/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          permissions: selectedPermission,
          durationMs: selectedDuration,
          maxUses: singleUse,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate share link');
      }

      const data = await response.json();
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const fullLink = `${baseUrl}/share/${data.token}`;
      setGeneratedLink(fullLink);

      // Refresh active links
      await fetchActiveLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleRevokeLink = async (tokenHash: string) => {
    try {
      const response = await fetch('/api/invoices/share-links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenHash }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke link');
      }

      // Refresh active links
      await fetchActiveLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke link');
    }
  };

  if (!open) return null;

  return (
    <FocusTrap onClose={onClose}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-link-title"
      >
        <div className="bg-gray-900 rounded-lg shadow-2xl max-w-lg w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 id="share-link-title" className="text-xl font-bold text-white">
                Share Invoice
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Generate Link Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-200">Generate New Link</h3>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Link Duration
                </label>
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(Number(e.target.value))}
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm disabled:opacity-50"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.ms} value={opt.ms}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Permission */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Permission Level
                </label>
                <div className="space-y-2">
                  {(['read', 'comment', 'read-only'] as const).map((perm) => (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="permission"
                        value={perm}
                        checked={selectedPermission === perm}
                        onChange={(e) => setSelectedPermission(e.target.value as ShareLinkPermission)}
                        disabled={loading}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-300 capitalize">{perm}</span>
                      <span className="text-xs text-gray-500">
                        {perm === 'read' && '(view only)'}
                        {perm === 'comment' && '(view + comment)'}
                        {perm === 'read-only' && '(view only)'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Single Use */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={singleUse}
                  onChange={(e) => setSingleUse(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">Single use only (expires after first access)</span>
              </label>

              {/* Generated Link */}
              {generatedLink && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded space-y-2">
                  <p className="text-xs font-medium text-green-400">Link Generated!</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={generatedLink}
                      readOnly
                      className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 font-mono"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        copied
                          ? 'bg-green-600 text-white'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerateLink}
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                {loading ? 'Generating...' : 'Generate Link'}
              </button>
            </div>

            {/* Active Links */}
            {activeLinks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-200">Active Links</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activeLinks.map((link) => {
                    const expiresAt = new Date(link.expiresAt);
                    const isExpiringSoon = expiresAt.getTime() - Date.now() < 3600000; // < 1 hour
                    return (
                      <div
                        key={link.tokenHash}
                        className="p-3 bg-gray-800/50 border border-gray-700 rounded space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-300">
                              Permission: <span className="capitalize">{link.permissions}</span>
                            </p>
                            <p className={`text-xs ${isExpiringSoon ? 'text-yellow-400' : 'text-gray-400'}`}>
                              Expires: {expiresAt.toLocaleString()}
                            </p>
                            {link.maxUses && (
                              <p className="text-xs text-gray-400">
                                Uses: {link.usesConsumed}/{link.maxUses}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRevokeLink(link.tokenHash)}
                            className="px-2 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
