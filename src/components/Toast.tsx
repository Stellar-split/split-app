'use client';
import { useState, useEffect } from 'react';

interface Props {
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss?: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'info', onDismiss, duration }: Props) {
  const colors = { success: 'bg-green-700', error: 'bg-red-700', info: 'bg-gray-700' };
  const [isHovering, setIsHovering] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (isHovering || !duration) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          onDismiss?.();
          return 0;
        }
        return prev - (100 / (duration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isHovering, duration, onDismiss]);

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
        {onDismiss && <button onClick={onDismiss} aria-label="Dismiss notification">✕</button>}
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
