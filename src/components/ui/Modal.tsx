"use client";

import type { ReactNode } from "react";
import FocusTrap from "@/components/FocusTrap";

interface ModalProps {
  /** Whether the modal is open. When false the modal is not rendered. */
  open: boolean;
  /** Called when the overlay is clicked or Escape is pressed. */
  onClose: () => void;
  /** Accessible title for the dialog — rendered in a visually-hidden h2
   *  unless `hideTitle` is set, in which case it is only used for aria-label. */
  title: string;
  /** When true the title text is visually hidden (sr-only) but still read by
   *  screen readers via aria-labelledby. Defaults to false. */
  hideTitle?: boolean;
  /** Additional class names to apply to the inner panel div. */
  className?: string;
  children: ReactNode;
}

/**
 * Modal — accessible dialog shell.
 *
 * Features:
 * - Focus is trapped inside while open (via FocusTrap)
 * - Escape key closes the modal (via FocusTrap)
 * - Focus returns to the previously focused element when closed (via FocusTrap)
 * - Clicking the backdrop closes the modal
 * - role="dialog" + aria-modal="true" + aria-labelledby wired up automatically
 *
 * Usage:
 * ```tsx
 * <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Confirm action">
 *   <p>Are you sure?</p>
 *   <button onClick={() => setIsOpen(false)}>Yes</button>
 * </Modal>
 * ```
 */
export default function Modal({
  open,
  onClose,
  title,
  hideTitle = false,
  className = "",
  children,
}: ModalProps) {
  if (!open) return null;

  const titleId = `modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <FocusTrap onClose={onClose}>
        <div
          className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title row */}
          <div className="flex items-center justify-between gap-4">
            <h2
              id={titleId}
              className={hideTitle ? "sr-only" : "text-lg font-semibold text-gray-900 dark:text-gray-100"}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="ml-auto shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {children}
        </div>
      </FocusTrap>
    </div>
  );
}
