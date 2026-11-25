'use client';
import { useState, useEffect, useRef } from 'react';

interface Props {
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss?: () => void;
  duration?: number;
}

const TICK_MS = 100;

/**
 * Toast notification with an optional auto-dismiss progress bar.
 * Progress pauses while hovered and resumes on hover end.
 */
export default function Toast({ message, type = 'info', onDismiss, duration }: Props) {
  const colors = { success: 'bg-green-700', error: 'bg-red-700', info: 'bg-gray-700' };
  const [isHovering, setIsHovering] = useState(false);
  const [progress, setProgress] = useState(100);
  const dismissedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (isHovering || !duration) return;

    const step = (TICK_MS / duration) * 100;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) {
          if (!dismissedRef.current) {
            dismissedRef.current = true;
            onDismissRef.current?.();
          }
          return 0;
        }
        return next;
      });
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [isHovering, duration]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex flex-col gap-3 px-4 py-3 rounded-xl text-white text-sm shadow-lg ${colors[type]}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex items-center gap-3">
        <span className="flex-1">{message}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={() => {
              dismissedRef.current = true;
              onDismiss();
            }}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        )}
      </div>
      {duration && (
        <div className="w-full h-0.5 bg-black/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/50 rounded-full transition-all"
            style={{
              width: `${progress}%`,
              transitionDuration: isHovering ? '0s' : '100ms',
            }}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
