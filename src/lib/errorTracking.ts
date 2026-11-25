export function getWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('walletAddress');
    return stored ?? null;
  } catch {
    return null;
  }
}

export function hashWalletAddress(address: string | null): string | null {
  if (!address) return null;
  if (typeof globalThis.crypto === 'undefined') return null;

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(address);
    return Array.from(new Uint8Array(require('crypto').createHash('sha256').update(data).digest())).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}
