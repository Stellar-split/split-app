'use client';

export interface ReconnectionBannerProps {
  show?: boolean;
  isConnected?: boolean;
}

export function ReconnectionBanner({ show, isConnected }: ReconnectionBannerProps) {
  if (!show) return null;

  return (
    <div className="mb-4 p-3 bg-yellow-950 border border-yellow-700 text-yellow-300 rounded-lg text-sm">
      {isConnected ? '✓ Reconnected' : '⚠ Reconnecting...'}
    </div>
  );
}

export default ReconnectionBanner;
