/**
 * Cooldown utilities — mirrors the DeadlineEngine.getCountdown API that will
 * ship in @stellar-split/sdk (split-sdk issue #9). Until that lands, the
 * countdown logic lives here and can be replaced with a re-export once the SDK
 * version is bumped.
 */

export interface Countdown {
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // seconds remaining
}

export const DeadlineEngine = {
  /** Returns remaining time breakdown, or null if expired / no cooldown. */
  getCountdown(expiresAt: number): Countdown | null {
    const total = expiresAt - Math.floor(Date.now() / 1000);
    if (total <= 0) return null;
    return {
      total,
      hours: Math.floor(total / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    };
  },

  formatCountdown({ hours, minutes, seconds }: Countdown): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
    return `${seconds}s`;
  },
};

const cooldownKey = (invoiceId: string, wallet: string) =>
  `cooldown-${invoiceId}-${wallet}`;

/**
 * Fetch the cooldown expiry timestamp (unix seconds) for a wallet on an
 * invoice. Returns null when no cooldown is active.
 *
 * When the SDK ships getCooldown() this function can call it instead of
 * reading from localStorage.
 */
export async function fetchCooldownExpiry(
  invoiceId: string,
  walletAddress: string
): Promise<number | null> {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(cooldownKey(invoiceId, walletAddress));
  if (!raw) return null;
  const ts = parseInt(raw, 10);
  if (isNaN(ts) || ts <= Math.floor(Date.now() / 1000)) {
    localStorage.removeItem(cooldownKey(invoiceId, walletAddress));
    return null;
  }
  return ts;
}

/**
 * Persist a cooldown record after a successful payment.
 * Returns the expiry unix timestamp.
 */
export function recordCooldown(
  invoiceId: string,
  walletAddress: string,
  durationSeconds = 86_400
): number {
  const expiresAt = Math.floor(Date.now() / 1000) + durationSeconds;
  if (typeof window !== "undefined") {
    localStorage.setItem(
      cooldownKey(invoiceId, walletAddress),
      String(expiresAt)
    );
  }
  return expiresAt;
}

/** Remove a cooldown record (called when expiry is detected client-side). */
export function clearCooldown(invoiceId: string, walletAddress: string): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(cooldownKey(invoiceId, walletAddress));
  }
}
