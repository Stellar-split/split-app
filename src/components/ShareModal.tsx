'use client';

import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import FocusTrap from './FocusTrap';
import CopyButton from './CopyButton';

interface ShareModalProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

type Tab = 'link' | 'qr' | 'embed';

export default function ShareModal({ open, url, onClose }: ShareModalProps) {
  const [tab, setTab] = useState<Tab>('link');

  if (!open) return null;

  const embedSnippet = `<iframe src="${url}/embed" width="100%" height="400" frameborder="0"></iframe>`;

  const downloadQR = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#share-qr-canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'qrcode.png';
    a.click();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'link', label: 'Link' },
    { id: 'qr', label: 'QR Code' },
    { id: 'embed', label: 'Embed' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <FocusTrap onClose={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          className="w-full sm:w-[420px] bg-gray-900 rounded-2xl shadow-xl border border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200">Share invoice</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-300"
              aria-label="Close share modal"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  tab === id
                    ? 'text-white border-b-2 border-indigo-500'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="px-4 py-5">
            {tab === 'link' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-400 break-all font-mono">{url}</p>
                <CopyButton text={url} className="w-full justify-center py-3" />
              </div>
            )}

            {tab === 'qr' && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white rounded-xl p-3">
                  <QRCodeCanvas id="share-qr-canvas" value={url} size={240} level="M" includeMargin={false} />
                </div>
                <button
                  onClick={downloadQR}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors"
                >
                  Download PNG
                </button>
              </div>
            )}

            {tab === 'embed' && (
              <div className="flex flex-col gap-3">
                <pre className="text-xs text-gray-400 font-mono break-all whitespace-pre-wrap bg-gray-800 rounded-lg p-3">
                  {embedSnippet}
                </pre>
                <CopyButton text={embedSnippet} className="w-full justify-center py-3" />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-800">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 rounded-lg bg-transparent hover:bg-gray-800 border border-gray-800 text-sm font-semibold text-gray-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
