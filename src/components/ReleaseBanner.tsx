'use client';

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface Props {
  invoiceId: string;
  onDismiss: () => void;
}

/**
 * ReleaseBanner — shown when an invoice is released.
 * Displays a celebratory banner with confetti animation.
 */
export default function ReleaseBanner({ invoiceId, onDismiss }: Props) {
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;

    // Fire confetti from both sides
    const duration = 3_000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center pointer-events-none"
    >
      <div className="mt-4 mx-4 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4 pointer-events-auto animate-bounce-in">
        <span className="text-3xl">🎉</span>
        <div className="flex-1">
          <p className="font-bold text-lg">Invoice Released!</p>
          <p className="text-sm text-green-100">
            Invoice #{invoiceId} has been fully released to recipients.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          aria-label="Dismiss release banner"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}