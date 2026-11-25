import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import {
  encryptData,
  decryptData,
  hashData,
  KeyRotationManager,
  EncryptionValidator,
  defaultEncryptionConfig,
} from '@/lib/encryption';

const sharedKeyManager = new KeyRotationManager();

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { action, data, password, encryptedData } = body;

  if (action === 'encrypt') {
    if (typeof data !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'data and password are required strings' }, { status: 400 });
    }
    if (!EncryptionValidator.validatePassword(password)) {
      return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
    }
    const result = encryptData(data, password);
    return NextResponse.json({ encrypted: result });
  }

  if (action === 'decrypt') {
    if (!encryptedData || typeof password !== 'string') {
      return NextResponse.json({ error: 'encryptedData and password are required' }, { status: 400 });
    }
    if (!EncryptionValidator.validateEncryptedData(encryptedData)) {
      return NextResponse.json({ error: 'Invalid encrypted data format' }, { status: 400 });
    }
    try {
      const decrypted = decryptData(encryptedData, password);
      return NextResponse.json({ decrypted });
    } catch {
      return NextResponse.json({ error: 'Decryption failed' }, { status: 400 });
    }
  }

  if (action === 'hash') {
    if (typeof data !== 'string') {
      return NextResponse.json({ error: 'data is required' }, { status: 400 });
    }
    return NextResponse.json({ hash: hashData(data) });
  }

  if (action === 'rotate') {
    const newKeyId = sharedKeyManager.rotateKey();
    return NextResponse.json({ keyId: newKeyId, rotatedAt: Date.now() });
  }

  if (action === 'audit') {
    const config = body.config ?? defaultEncryptionConfig;
    const valid = EncryptionValidator.validateEncryptionConfig(config);
    return NextResponse.json({
      valid,
      shouldRotate: sharedKeyManager.shouldRotate(),
      currentKeyId: sharedKeyManager.getCurrentKeyId(),
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
