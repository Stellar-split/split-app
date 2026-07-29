'use client';

import React from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string | null;
  children: React.ReactNode;
  helperText?: string;
  required?: boolean;
}

export default function FormField({
  id,
  label,
  error,
  children,
  helperText,
  required = false,
}: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        {React.cloneElement(children as React.ReactElement, {
          id,
          'aria-describedby': errorId || helperText ? `${id}-hint` : undefined,
          'aria-invalid': !!error,
        })}

        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18.364 5.364l-12.728 12.728m12.728 0L5.636 5.364m0 0a1 1 0 00-1.414 0L1.586 8.414a1 1 0 000 1.414l12.728 12.728a1 1 0 001.414 0l3.364-3.364a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 mt-1"
        >
          {error}
        </p>
      )}

      {helperText && !error && (
        <p id={`${id}-hint`} className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
}
