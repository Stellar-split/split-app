/**
 * attestation.ts — Creator verification attestation system
 * 
 * Stores signed attestations in localStorage to prove creator identity.
 * Attestations expire after 30 days.
 */

export interface CreatorAttestation {
  address: string;
  signature: string;
  timestamp: number; // Unix timestamp in milliseconds
}

const STORAGE_KEY = "stellarsplit_creator_attestations";
const ATTESTATION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Generate a challenge message for signing
 */
export function generateChallenge(address: string): string {
  const timestamp = Date.now();
  return `StellarSplit Creator Verification\nAddress: ${address}\nTimestamp: ${timestamp}`;
}

/**
 * Get all stored attestations (removes expired ones)
 */
export function getAttestations(): Record<string, CreatorAttestation> {
  if (typeof window === "undefined") return {};
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    
    const attestations: Record<string, CreatorAttestation> = JSON.parse(raw);
    const now = Date.now();
    
    // Filter out expired attestations
    const valid: Record<string, CreatorAttestation> = {};
    for (const [address, attestation] of Object.entries(attestations)) {
      if (now - attestation.timestamp < ATTESTATION_EXPIRY_MS) {
        valid[address] = attestation;
      }
    }
    
    // Save back if we removed any
    if (Object.keys(valid).length !== Object.keys(attestations).length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }
    
    return valid;
  } catch {
    return {};
  }
}

/**
 * Store a new attestation
 */
export function storeAttestation(attestation: CreatorAttestation): void {
  if (typeof window === "undefined") return;
  
  const attestations = getAttestations();
  attestations[attestation.address] = attestation;
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attestations));
}

/**
 * Check if an address has a valid attestation
 */
export function isVerifiedCreator(address: string): boolean {
  const attestations = getAttestations();
  return address in attestations;
}

/**
 * Get attestation for a specific address
 */
export function getAttestation(address: string): CreatorAttestation | null {
  const attestations = getAttestations();
  return attestations[address] || null;
}

/**
 * Remove attestation for an address
 */
export function removeAttestation(address: string): void {
  if (typeof window === "undefined") return;
  
  const attestations = getAttestations();
  delete attestations[address];
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attestations));
}
