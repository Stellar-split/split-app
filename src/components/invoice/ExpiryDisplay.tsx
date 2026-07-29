'use client';

interface ExpiryDisplayProps {
  timestamp: number;
  overrideTimezone?: string;
}

export default function ExpiryDisplay({
  timestamp,
  overrideTimezone,
}: ExpiryDisplayProps) {
  const date = new Date(timestamp * 1000);
  const timezone = overrideTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatted = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  }).format(date);

  const isExpired = date < new Date();

  return (
    <div className={`text-sm ${isExpired ? 'text-red-400' : 'text-gray-300'}`}>
      <span className="font-mono">{formatted}</span>
      {isExpired && <span className="ml-2 text-xs font-medium">(Expired)</span>}
    </div>
  );
}
