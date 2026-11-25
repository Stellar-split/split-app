'use client';

import { useState, useEffect } from 'react';

interface ExpiryDatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  onTimezoneChange?: (tz: string) => void;
  timezone?: string;
  error?: string;
}

export default function ExpiryDatePicker({
  value,
  onChange,
  onTimezoneChange,
  timezone: externalTimezone,
  error,
}: ExpiryDatePickerProps) {
  const [timezone, setTimezone] = useState<string>(() => {
    if (externalTimezone) return externalTimezone;
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    try {
      const supported = Intl.supportedValuesOf('timeZone') as string[];
      setTimezones(supported);
    } catch {
      setTimezones([]);
    }
  }, []);

  useEffect(() => {
    if (externalTimezone) {
      setTimezone(externalTimezone);
    }
  }, [externalTimezone]);

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    if (onTimezoneChange) {
      onTimezoneChange(tz);
    }
  };

  const isExpired = value && new Date(value) < new Date();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="expiry-date" className="block text-sm font-medium text-gray-300 mb-1">
            Expiry Date & Time
          </label>
          <input
            id="expiry-date"
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={isExpired || !!error}
            aria-describedby={error ? 'expiry-error' : undefined}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 aria-invalid:border-red-600 aria-invalid:ring-red-600"
          />
        </div>

        <div>
          <label htmlFor="timezone-select" className="block text-sm font-medium text-gray-300 mb-1">
            Timezone
          </label>
          <select
            id="timezone-select"
            value={timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(error || isExpired) && (
        <div
          id="expiry-error"
          role="alert"
          className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2"
        >
          {error || 'Expiry date cannot be in the past'}
        </div>
      )}
    </div>
  );
}
