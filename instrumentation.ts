import * as Sentry from "@sentry/nextjs";
import { initAnalytics } from "./lib/analytics/server";
import { registerBackupScheduler } from "./lib/backup/scheduler";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        debug: false,
      });
    }

    if (process.env.NEXT_RUNTIME === "edge") {
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        debug: false,
      });
    }
  }

  const analyticsEnabled =
    process.env.ANALYTICS_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true";

  if (
    analyticsEnabled &&
    (process.env.NEXT_RUNTIME === "nodejs" ||
      process.env.NEXT_RUNTIME === "edge")
  ) {
    const endpoint = process.env.ANALYTICS_ENDPOINT;
    const samplingRate = Number.parseFloat(
      process.env.ANALYTICS_SAMPLING_RATE ?? "1",
    );

    try {
      await initAnalytics({
        endpoint,
        samplingRate: Number.isFinite(samplingRate) ? samplingRate : 1,
        runtime: process.env.NEXT_RUNTIME,
      });
    } catch (error) {
      console.error("[instrumentation] Failed to initialize analytics", error);
    }
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      await registerBackupScheduler({
        onFailure: async (error: unknown, context: { runId?: string }) => {
          console.error("[instrumentation] Backup run failed", error, context);

          if (dsn) {
            Sentry.captureException(error, {
              tags: { component: "backup-scheduler" },
              extra: { runId: context?.runId },
            });
          }

          const { notifyBackupFailure } = await import(
            "./lib/notifications/backup"
          );
          await notifyBackupFailure({ error, context });
        },
      });
    } catch (error) {
      console.error(
        "[instrumentation] Failed to register backup scheduler",
        error,
      );
    }
  }
}