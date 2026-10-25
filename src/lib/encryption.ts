import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_SIZE = 32;
const IV_SIZE = 16;
const TAG_SIZE = 16;
const SALT_SIZE = 16;

interface EncryptedData {
  iv: string;
  encryptedData: string;
  authTag: string;
  salt: string;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_SIZE, 'sha256');
}

export function encryptData(data: string, password: string): EncryptedData {
  const salt = crypto.randomBytes(SALT_SIZE);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_SIZE);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
  };
}

export function decryptData(encryptedData: EncryptedData, password: string): string {
  const salt = Buffer.from(encryptedData.salt, 'hex');
  const key = deriveKey(password, salt);
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyRotationInterval: number; // ms
  encryptPII: boolean;
  encryptPayments: boolean;
}

export const defaultEncryptionConfig: EncryptionConfig = {
  enabled: true,
  algorithm: ALGORITHM,
  keyRotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
  encryptPII: true,
  encryptPayments: true,
};

export class KeyRotationManager {
  private keys: Map<string, { key: Buffer; createdAt: number }> = new Map();
  private rotationInterval: number;
  private currentKeyId: string;

  constructor(rotationIntervalMs: number = defaultEncryptionConfig.keyRotationInterval) {
    this.rotationInterval = rotationIntervalMs;
    this.currentKeyId = this.generateNewKeyId();
    this.keys.set(this.currentKeyId, {
      key: crypto.randomBytes(KEY_SIZE),
      createdAt: Date.now(),
    });
  }

  private generateNewKeyId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  rotateKey(): string {
    this.currentKeyId = this.generateNewKeyId();
    this.keys.set(this.currentKeyId, {
      key: crypto.randomBytes(KEY_SIZE),
      createdAt: Date.now(),
    });

    const expiredKeys = Array.from(this.keys.entries())
      .filter(([_, keyData]) => Date.now() - keyData.createdAt > this.rotationInterval * 2);

    expiredKeys.forEach(([keyId]) => this.keys.delete(keyId));

    return this.currentKeyId;
  }

  getCurrentKey(): Buffer {
    const keyData = this.keys.get(this.currentKeyId);
    if (!keyData) throw new Error('No current key available');
    return keyData.key;
  }

  getKeyById(keyId: string): Buffer | undefined {
    return this.keys.get(keyId)?.key;
  }

  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  shouldRotate(): boolean {
    const keyData = this.keys.get(this.currentKeyId);
    if (!keyData) return false;
    return Date.now() - keyData.createdAt > this.rotationInterval;
  }
}

export class EncryptionValidator {
  static validateEncryptedData(data: EncryptedData): boolean {
    return (
      data.iv && data.iv.length === IV_SIZE * 2 &&
      data.encryptedData && data.encryptedData.length > 0 &&
      data.authTag && data.authTag.length === TAG_SIZE * 2 &&
      data.salt && data.salt.length === SALT_SIZE * 2
    );
  }

  static validatePassword(password: string): boolean {
    return password && password.length >= 12;
  }

  static validateEncryptionConfig(config: EncryptionConfig): boolean {
    return (
      typeof config.enabled === 'boolean' &&
      config.algorithm === ALGORITHM &&
      config.keyRotationInterval > 0 &&
      typeof config.encryptPII === 'boolean' &&
      typeof config.encryptPayments === 'boolean'
    );
  }
}
