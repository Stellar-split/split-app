import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

export interface SecuritySettings {
  userId: string;
  mfaEnabled: boolean;
  mfaConfigured: boolean;
  highValueThreshold: number;
  encryptedSecret?: string;
  failedAttempts: number;
  lockedUntil?: number;
}

interface PendingEnrollment {
  userId: string;
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  expiresAt: number;
}

interface StoredMfaToken {
  userId: string;
  expiresAt: number;
  used: boolean;
}

const TOKEN_TTL_MS = 60_000;
const LOCKOUT_MS = 30_000;
const MAX_FAILURES = 5;
const SECURITY_STORE = new Map<string, SecuritySettings>();
const PENDING_ENROLLMENTS = new Map<string, PendingEnrollment>();
const MFA_TOKENS = new Map<string, StoredMfaToken>();

function getDefaultSettings(userId: string): SecuritySettings {
  return {
    userId,
    mfaEnabled: false,
    mfaConfigured: false,
    highValueThreshold: 1000,
    failedAttempts: 0,
  };
}

function getEncryptionKey(): Buffer {
  const baseKey = process.env.MFA_ENCRYPTION_KEY || "stellar-split-mfa-default-key-32-chars!";
  return createHash("sha256").update(baseKey).digest();
}

function encryptSecret(value: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptSecret(payload: string): string {
  const [ivHex, encryptedHex] = payload.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid encrypted secret payload");
  }

  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function saveSettings(userId: string, updates: Partial<SecuritySettings>): SecuritySettings {
  const current = SECURITY_STORE.get(userId) ?? getDefaultSettings(userId);
  const merged: SecuritySettings = {
    ...current,
    ...updates,
    userId,
  };
  SECURITY_STORE.set(userId, merged);
  return merged;
}

export function getSecuritySettings(userId: string): SecuritySettings {
  return SECURITY_STORE.get(userId) ?? getDefaultSettings(userId);
}

export async function beginMfaEnrollment(userId: string) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: "Stellar Split", label: userId, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  PENDING_ENROLLMENTS.set(userId, {
    userId,
    secret,
    otpauthUrl,
    qrCodeDataUrl,
    expiresAt: Date.now() + 10 * 60_000,
  });

  return {
    qrCodeDataUrl,
    otpauthUrl,
  };
}

export function confirmMfaEnrollment(userId: string, code: string) {
  const pending = PENDING_ENROLLMENTS.get(userId);
  if (!pending) {
    return { success: false, error: "No pending MFA enrollment found." };
  }

  if (pending.expiresAt < Date.now()) {
    PENDING_ENROLLMENTS.delete(userId);
    return { success: false, error: "Enrollment expired. Start again." };
  }

  const isValid = verifySync({ secret: pending.secret, token: code }).valid;
  if (!isValid) {
    return { success: false, error: "The verification code was invalid." };
  }

  const encryptedSecret = encryptSecret(pending.secret);
  const settings = saveSettings(userId, {
    mfaEnabled: true,
    mfaConfigured: true,
    encryptedSecret,
    failedAttempts: 0,
    lockedUntil: undefined,
  });

  PENDING_ENROLLMENTS.delete(userId);
  return { success: true, settings };
}

export function disableMfa(userId: string, code: string) {
  const settings = getSecuritySettings(userId);
  if (!settings.encryptedSecret) {
    return { success: false, error: "MFA is not currently enabled." };
  }

  const secret = decryptSecret(settings.encryptedSecret);
  const isValid = verifySync({ secret: secret, token: code }).valid;
  if (!isValid) {
    return { success: false, error: "The verification code was invalid." };
  }

  const updated = saveSettings(userId, {
    mfaEnabled: false,
    mfaConfigured: false,
    encryptedSecret: undefined,
    failedAttempts: 0,
    lockedUntil: undefined,
  });

  return { success: true, settings: updated };
}

export function saveHighValueThreshold(userId: string, threshold: number) {
  return saveSettings(userId, { highValueThreshold: Math.max(0, threshold) });
}

export function verifyMfaCode(userId: string, code: string) {
  const settings = getSecuritySettings(userId);
  if (!settings.mfaConfigured || !settings.encryptedSecret) {
    return { success: false, error: "MFA is not enabled for this account." };
  }

  const now = Date.now();
  if (settings.lockedUntil && settings.lockedUntil > now) {
    return {
      success: false,
      error: "MFA is temporarily locked after repeated failures.",
      lockedUntil: settings.lockedUntil,
    };
  }

  try {
    const secret = decryptSecret(settings.encryptedSecret);
    const isValid = verifySync({ secret: secret, token: code }).valid;
    if (!isValid) {
      const nextAttempts = (settings.failedAttempts || 0) + 1;
      const lockedUntil = nextAttempts >= MAX_FAILURES ? now + LOCKOUT_MS : undefined;
      saveSettings(userId, {
        failedAttempts: nextAttempts,
        lockedUntil,
      });
      return {
        success: false,
        error: nextAttempts >= MAX_FAILURES ? "Too many failed attempts. MFA is locked for 30 seconds." : "The verification code was invalid.",
        failedAttempts: nextAttempts,
        lockedUntil,
      };
    }

    saveSettings(userId, {
      failedAttempts: 0,
      lockedUntil: undefined,
    });

    const tokenId = `${userId}:${now}:${Math.random().toString(36).slice(2)}`;
    const expiresAt = now + TOKEN_TTL_MS;
    MFA_TOKENS.set(tokenId, { userId, expiresAt, used: false });

    return {
      success: true,
      mfaToken: tokenId,
      expiresAt,
    };
  } catch {
    return { success: false, error: "Unable to verify the MFA code." };
  }
}

export function consumeMfaToken(token: string) {
  const entry = MFA_TOKENS.get(token);
  if (!entry) {
    return { success: false, error: "The MFA token is invalid or expired." };
  }

  if (entry.used || entry.expiresAt < Date.now()) {
    MFA_TOKENS.delete(token);
    return { success: false, error: "The MFA token has already been used or expired." };
  }

  entry.used = true;
  MFA_TOKENS.set(token, entry);
  return { success: true };
}
