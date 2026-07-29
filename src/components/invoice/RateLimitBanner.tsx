'use client';

interface RateLimitBannerProps {
  isVisible: boolean;
  secondsRemaining: number;
  retryAfterSeconds: number | null;
}

export default function RateLimitBanner({
  isVisible,
  secondsRemaining,
  retryAfterSeconds,
}: RateLimitBannerProps) {
  if (!isVisible) return null;

  if (retryAfterSeconds === null) {
    return (
      <div className="w-full bg-yellow-900 border border-yellow-700 rounded-lg px-4 py-3 text-sm text-yellow-100">
        <p>Please wait before trying again</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-yellow-900 border border-yellow-700 rounded-lg px-4 py-3 text-sm text-yellow-100">
      <p>You can create another invoice in {secondsRemaining} s</p>
    </div>
  );
}
