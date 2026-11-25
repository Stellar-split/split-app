/**
 * App-level Stellar / Soroban configuration.
 * Mirrors env vars used by `src/lib/stellar.ts` so settings pages can import a single module.
 */

export const STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  (STELLAR_NETWORK === "mainnet"
    ? "https://soroban.stellar.org"
    : "https://soroban-testnet.stellar.org");

/** StellarSplit contract ID used for on-chain calls and event filtering. */
export const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

/**
 * Analytics configuration.
 *
 * Env vars:
 *   NEXT_PUBLIC_ANALYTICS_ENABLED  - "true" to enable client-side analytics
 *   NEXT_PUBLIC_ANALYTICS_PROVIDER - provider name (e.g. "posthog", "plausible")
 *   NEXT_PUBLIC_ANALYTICS_ENDPOINT - ingestion / API endpoint for the provider
 *   NEXT_PUBLIC_ANALYTICS_SAMPLE_RATE - sampling rate in [0, 1] (default 1)
 */
export const ANALYTICS_ENABLED =
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true";

export const ANALYTICS_PROVIDER =
  process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "posthog";

export const ANALYTICS_ENDPOINT =
  process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT ?? "";

function parseSampleRate(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1, Math.max(0, parsed));
}

export const ANALYTICS_SAMPLE_RATE = parseSampleRate(
  process.env.NEXT_PUBLIC_ANALYTICS_SAMPLE_RATE,
);

export const analyticsConfig = {
  enabled: ANALYTICS_ENABLED,
  provider: ANALYTICS_PROVIDER,
  endpoint: ANALYTICS_ENDPOINT,
  sampleRate: ANALYTICS_SAMPLE_RATE,
} as const;

/**
 * Backup / disaster-recovery configuration.
 *
 * Env vars:
 *   NEXT_PUBLIC_BACKUP_BUCKET          - object storage bucket for backups
 *   NEXT_PUBLIC_BACKUP_GEO_REGION      - geo-replica region for redundancy
 *   NEXT_PUBLIC_BACKUP_INTERVAL_MINUTES - backup schedule interval in minutes
 *   NEXT_PUBLIC_BACKUP_ALERT_WEBHOOK   - webhook URL alerted on backup failure
 */
export const BACKUP_BUCKET = process.env.NEXT_PUBLIC_BACKUP_BUCKET ?? "";

export const BACKUP_GEO_REGION =
  process.env.NEXT_PUBLIC_BACKUP_GEO_REGION ?? "";

function parseIntervalMinutes(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 60;
  return Math.floor(parsed);
}

export const BACKUP_INTERVAL_MINUTES = parseIntervalMinutes(
  process.env.NEXT_PUBLIC_BACKUP_INTERVAL_MINUTES,
);

export const BACKUP_ALERT_WEBHOOK =
  process.env.NEXT_PUBLIC_BACKUP_ALERT_WEBHOOK ?? "";

export const backupConfig = {
  bucket: BACKUP_BUCKET,
  geoRegion: BACKUP_GEO_REGION,
  intervalMinutes: BACKUP_INTERVAL_MINUTES,
  alertWebhook: BACKUP_ALERT_WEBHOOK,
} as const;

export const config = {
  network: STELLAR_NETWORK,
  rpcUrl: RPC_URL,
  contractId,
  analytics: analyticsConfig,
  backup: backupConfig,
} as const;

export default config;