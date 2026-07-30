"use client";

import { useState, useEffect } from "react";
import {
  getSnoozeState,
  snoozeInvoice,
  getTimeRemaining,
  getOverdueDuration,
  clearSnooze,
  shouldShowCountdown,
  type SnoozeOption,
} from "@/lib/expirySnooze";

interface Props {
  invoiceId: string;
  dueDate: Date;
  isCreator?: boolean; // Show snooze only for creators
  onPaymentMade?: () => void;
}

/**
 * ExpiryCountdownBanner — displays dynamic countdown for invoices nearing/past due date
 *
 * Features:
 * - Shows countdown for invoices within 72 hours of expiration
 * - Amber color for upcoming expiry, red for overdue
 * - Snooze functionality (creator-only) for 1h, 4h, or until tomorrow
 * - Real-time updates via setInterval
 */
export default function ExpiryCountdownBanner({
  invoiceId,
  dueDate,
  isCreator = false,
  onPaymentMade,
}: Props) {
  const [show, setShow] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    isOverdue: boolean;
  } | null>(null);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  // Initialize and set up countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      // Check if snoozed
      if (!shouldShowCountdown(invoiceId)) {
        setShow(false);
        return;
      }

      const time = getTimeRemaining(dueDate);

      // Show if within 72 hours or overdue
      if (time.isOverdue || time.days < 3) {
        setShow(true);
        setTimeRemaining(time);
      } else {
        setShow(false);
      }
    };

    // Initial update
    updateCountdown();

    // Update every minute
    const interval = setInterval(updateCountdown, 60 * 1000);

    return () => clearInterval(interval);
  }, [invoiceId, dueDate]);

  if (!show || !timeRemaining) return null;

  const isOverdue = timeRemaining.isOverdue;
  const bgColor = isOverdue
    ? "bg-red-50 dark:bg-red-900/20"
    : "bg-amber-50 dark:bg-amber-900/20";
  const borderColor = isOverdue
    ? "border-red-200 dark:border-red-800"
    : "border-amber-200 dark:border-amber-800";
  const textColor = isOverdue
    ? "text-red-800 dark:text-red-200"
    : "text-amber-800 dark:text-amber-200";
  const badgeColor = isOverdue
    ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
    : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";

  const handleSnooze = (option: SnoozeOption) => {
    snoozeInvoice(invoiceId, option);
    setShow(false);
    setShowSnoozeMenu(false);
  };

  const handlePaymentMade = () => {
    clearSnooze(invoiceId);
    setShow(false);
    onPaymentMade?.();
  };

  if (isOverdue) {
    const overdue = getOverdueDuration(dueDate);
    return (
      <div
        className={`${bgColor} border ${borderColor} rounded-lg p-4 mb-4 flex items-start justify-between`}
      >
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">🔴</span>
          <div>
            <p className={`font-semibold ${textColor}`}>
              Overdue by {overdue.days}d {overdue.hours}h {overdue.minutes}m
            </p>
            <p className={`text-sm mt-1 ${textColor} opacity-90`}>
              This invoice is past its due date. Please reach out to the payer if payment
              hasn&apos;t been received.
            </p>
          </div>
        </div>
        {isCreator && (
          <button
            onClick={() => setShow(false)}
            className={`mt-1 text-sm font-medium px-2 py-1 rounded ${badgeColor} hover:opacity-80 transition-opacity`}
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-lg p-4 mb-4 flex items-start justify-between`}
    >
      <div className="flex items-start gap-3 flex-1">
        <span className="text-xl mt-0.5">⏱️</span>
        <div>
          <p className={`font-semibold ${textColor}`}>
            Expires in {timeRemaining.days}d {timeRemaining.hours}h{" "}
            {timeRemaining.minutes}m
          </p>
          <p className={`text-sm mt-1 ${textColor} opacity-90`}>
            {timeRemaining.days === 0 && timeRemaining.hours < 24
              ? "This invoice expires very soon."
              : "Send a reminder to payers to complete payment before the deadline."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
        {isCreator && (
          <div className="relative">
            <button
              onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
              className={`text-xs font-medium px-3 py-1.5 rounded ${badgeColor} hover:opacity-80 transition-opacity`}
            >
              Snooze ▼
            </button>

            {showSnoozeMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-max">
                <button
                  onClick={() => handleSnooze("1h")}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Snooze for 1 hour
                </button>
                <button
                  onClick={() => handleSnooze("4h")}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700"
                >
                  Snooze for 4 hours
                </button>
                <button
                  onClick={() => handleSnooze("until-tomorrow")}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700"
                >
                  Snooze until tomorrow
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setShow(false)}
          className={`text-xs font-medium px-3 py-1.5 rounded ${badgeColor} hover:opacity-80 transition-opacity`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
