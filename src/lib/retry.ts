export async function retryWithBackoff(fn: () => Promise<any>, maxAttempts = 3): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

export function parseRetryAfter(header?: string): number {
  if (!header) return 0;
  const seconds = parseInt(header, 10);
  return isNaN(seconds) ? 0 : seconds * 1000;
}

export function recordRetryMetric(name: string, attempt: number): void {
  // No-op stub
}
