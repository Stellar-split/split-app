// src/lib/mobileEncryption.ts
// Mobile-specific secure storage with encryption, using the core encryption lib.

import { encryptData, decryptData, hashData, KeyRotationManager, EncryptionValidator, type EncryptionConfig, defaultEncryptionConfig } from './encryption';

export interface SecureStorageOptions {
  config?: EncryptionConfig;
}

export interface StoredSecureEntry {
  key: string;
  encrypted: string;   // JSON-serialised EncryptedData
  storedAt: number;
  keyId: string;
}

export interface SecurityAuditResult {
  passed: boolean;
  issues: string[];
  checkedAt: number;
}

/**
 * Client-side secure storage façade. In a real mobile app this would wrap
 * platform-native secure storage (Keychain / Keystore). Here it wraps
 * localStorage with AES-256-GCM encryption so the codebase has the correct
 * abstractions without requiring native bridges.
 */
export class MobileSecureStorage {
  private keyManager: KeyRotationManager;
  private config: EncryptionConfig;
  private prefix = 'secure_';

  constructor(options: SecureStorageOptions = {}) {
    this.config = options.config ?? defaultEncryptionConfig;
    this.keyManager = new KeyRotationManager(this.config.keyRotationInterval);
  }

  /** Encrypt and store a value under the given key. */
  store(storageKey: string, value: string, password: string): void {
    if (this.keyManager.shouldRotate()) {
      this.keyManager.rotateKey();
    }
    const encrypted = encryptData(value, password);
    const entry: StoredSecureEntry = {
      key: storageKey,
      encrypted: JSON.stringify(encrypted),
      storedAt: Date.now(),
      keyId: this.keyManager.getCurrentKeyId(),
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.prefix + storageKey, JSON.stringify(entry));
    }
  }

  /** Retrieve and decrypt a stored value. Returns null if not found. */
  retrieve(storageKey: string, password: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(this.prefix + storageKey);
    if (!raw) return null;
    try {
      const entry: StoredSecureEntry = JSON.parse(raw);
      const encryptedData = JSON.parse(entry.encrypted);
      return decryptData(encryptedData, password);
    } catch {
      return null;
    }
  }

  /** Remove a stored entry. */
  remove(storageKey: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.prefix + storageKey);
    }
  }

  /** Trigger key rotation and return the new key ID. */
  rotateKey(): string {
    return this.keyManager.rotateKey();
  }

  /** Check whether key rotation is due. */
  shouldRotate(): boolean {
    return this.keyManager.shouldRotate();
  }

  /** Run an audit of the current encryption config and state. */
  audit(): SecurityAuditResult {
    const issues: string[] = [];
    if (!this.config.enabled) issues.push('Encryption is disabled');
    if (!EncryptionValidator.validateEncryptionConfig(this.config)) issues.push('Invalid encryption config');
    if (this.keyManager.shouldRotate()) issues.push('Key rotation is overdue');
    return { passed: issues.length === 0, issues, checkedAt: Date.now() };
  }

  /** Hash sensitive data for indexing/comparison without storing plaintext. */
  hashSensitiveData(data: string): string {
    return hashData(data);
  }

  /** Validate that an encrypted data blob is structurally correct. */
  validateEncryptedData(raw: string): boolean {
    try {
      return EncryptionValidator.validateEncryptedData(JSON.parse(raw));
    } catch {
      return false;
    }
  }
}

/** Singleton for the app — callers import this. */
export const mobileSecureStorage = new MobileSecureStorage();

/** Encrypt sensitive PII fields in an object, returning a sanitised copy. */
export function encryptSensitiveFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
  password: string
): T & { _encryptedFields: string[] } {
  const result = { ...obj } as Record<string, unknown>;
  const encrypted: string[] = [];
  for (const field of fields) {
    const val = obj[field];
    if (val !== undefined && val !== null) {
      result[field as string] = JSON.stringify(encryptData(String(val), password));
      encrypted.push(field as string);
    }
  }
  return { ...result, _encryptedFields: encrypted } as T & { _encryptedFields: string[] };
}

/** Decrypt sensitive PII fields that were encrypted by encryptSensitiveFields. */
export function decryptSensitiveFields<T extends Record<string, unknown>>(
  obj: T & { _encryptedFields?: string[] },
  password: string
): T {
  const result = { ...obj } as Record<string, unknown>;
  for (const field of obj._encryptedFields ?? []) {
    try {
      result[field] = decryptData(JSON.parse(result[field] as string), password);
    } catch {
      // leave as-is if decryption fails
    }
  }
  delete result._encryptedFields;
  return result as T;
}
