"use client";

import { useEmailValidation } from "@/hooks/useEmailValidation";

interface RecipientRowProps {
  email: string;
  onEmailChange: (email: string) => void;
  onBlur?: () => void;
}

export default function RecipientRow({
  email,
  onEmailChange,
  onBlur,
}: RecipientRowProps) {
  const { isValidFormat, isCheckingMX, mxValid } = useEmailValidation(email);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onBlur}
          placeholder="recipient@example.com"
          className={`flex-1 bg-gray-800 border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 ${
            !email
              ? "border-gray-700 focus:ring-indigo-500"
              : !isValidFormat
                ? "border-red-500 focus:ring-red-500"
                : mxValid === false
                  ? "border-yellow-500 focus:ring-yellow-500"
                  : "border-green-500 focus:ring-green-500"
          }`}
        />
        {email && isValidFormat && (
          <>
            {isCheckingMX && (
              <span className="text-xs text-gray-400">Checking...</span>
            )}
            {!isCheckingMX && mxValid === true && (
              <span className="text-green-500">✓</span>
            )}
            {!isCheckingMX && mxValid === false && (
              <span className="text-yellow-500">⚠</span>
            )}
          </>
        )}
      </div>

      {email && !isValidFormat && (
        <p className="text-xs text-red-400">Invalid email format</p>
      )}
      {email && isValidFormat && mxValid === false && !isCheckingMX && (
        <p className="text-xs text-yellow-400">Domain has no MX records (delivery may fail)</p>
      )}
    </div>
  );
}
