"use client";

import { useEffect } from "react";
import { checkAndFireReminders } from "@/lib/reminders";

/**
 * ReminderChecker — invisible client component that fires browser notifications
 * for any past-due reminders on every page load.
 */
export default function ReminderChecker() {
  useEffect(() => {
    checkAndFireReminders();
  }, []);

  return null;
}
