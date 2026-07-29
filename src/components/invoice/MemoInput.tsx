"use client";

import { useState, useCallback } from "react";
import { MEMO_MAX_BYTES } from "@/lib/stellar";

interface MemoInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MemoInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Add a memo (optional)",
}: MemoInputProps) {
  const byteLength = new TextEncoder().encode(value).length;
  const isAtLimit = byteLength >= MEMO_MAX_BYTES;
  const isOverLimit = byteLength > MEMO_MAX_BYTES;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div>
      <label htmlFor="memo-input" className="block text-sm font-medium text-gray-300 mb-1">
        Memo
      </label>
      <textarea
        id="memo-input"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        rows={2}
        className={`w-full min-h-16 bg-gray-900 border rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 disabled:opacity-70 resize-none ${
          isOverLimit
            ? "border-red-600 focus:ring-red-500"
            : "border-gray-700 focus:ring-indigo-500"
        }`}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">
          {byteLength} / {MEMO_MAX_BYTES} bytes
        </span>
        {isAtLimit && (
          <span className={`text-xs font-medium ${isOverLimit ? "text-red-400" : "text-yellow-400"}`}>
            {isOverLimit ? "Exceeds limit" : "At limit"}
          </span>
        )}
      </div>
    </div>
  );
}
