'use client';

import React, { useEffect, useRef } from 'react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
  title?: string;
  message?: string;
}

export default function UnsavedChangesModal({
  isOpen,
  onDiscard,
  onKeepEditing,
  title = 'Discard changes?',
  message = 'You have unsaved changes. If you leave now, your work will be lost.',
}: UnsavedChangesModalProps) {
  const focusTrapRef = useRef<HTMLDivElement>(null);
  const discardButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const trapElement = focusTrapRef.current;
      const focusableElements = trapElement?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements && focusableElements.length > 0) {
        (focusableElements[focusableElements.length - 1] as HTMLElement).focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onKeepEditing}
        aria-hidden="true"
      />
      <div
        ref={focusTrapRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-message"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-sm w-full animate-in fade-in-50 zoom-in-95">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2
              id="unsaved-title"
              className="text-lg font-semibold text-gray-100"
            >
              {title}
            </h2>
          </div>

          <div className="px-6 py-3">
            <p
              id="unsaved-message"
              className="text-sm text-gray-400"
            >
              {message}
            </p>
          </div>

          <div className="px-6 py-4 border-t border-gray-700 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onKeepEditing}
              className="min-h-10 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Keep editing
            </button>
            <button
              ref={discardButtonRef}
              type="button"
              onClick={onDiscard}
              className="min-h-10 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
