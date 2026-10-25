import https from 'https';
import fs from 'fs';
import path from 'path';

export interface TLSConfig {
  enabled: boolean;
  certPath?: string;
  keyPath?: string;
  minTLSVersion: string;
  ciphers: string[];
  requireClientCert: boolean;
}

export const defaultTLSConfig: TLSConfig = {
  enabled: process.env.NODE_ENV === 'production',
  minTLSVersion: 'TLSv1.2',
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
  ],
  requireClientCert: false,
};

export class TLSManager {
  private config: TLSConfig;
  private server?: https.Server;

  constructor(config: Partial<TLSConfig> = {}) {
    this.config = { ...defaultTLSConfig, ...config };
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.enabled) return;

    if (!this.config.certPath || !this.config.keyPath) {
      throw new Error('TLS enabled but certPath or keyPath not provided');
    }

    if (!fs.existsSync(this.config.certPath)) {
      throw new Error(`Certificate file not found: ${this.config.certPath}`);
    }

    if (!fs.existsSync(this.config.keyPath)) {
      throw new Error(`Key file not found: ${this.config.keyPath}`);
    }
  }

  getHTTPSOptions(): https.ServerOptions {
    if (!this.config.enabled) {
      throw new Error('TLS is not enabled');
    }

    const cert = fs.readFileSync(this.config.certPath!);
    const key = fs.readFileSync(this.config.keyPath!);

    return {
      cert,
      key,
      minVersion: this.config.minTLSVersion as any,
      ciphers: this.config.ciphers.join(':'),
      rejectUnauthorized: this.config.requireClientCert,
      honorCipherOrder: true,
    };
  }

  createServer(requestListener: https.RequestListener): https.Server {
    if (!this.config.enabled) {
      throw new Error('TLS is not enabled');
    }

    this.server = https.createServer(this.getHTTPSOptions(), requestListener);
    return this.server;
  }

  getConfig(): TLSConfig {
    return { ...this.config };
  }
}

export function createSecurityHeaders() {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  };
}

export function setupTLSForNextjs(config?: Partial<TLSConfig>) {
  return {
    experimental: {
      serverComponentsExternalPackages: ['https'],
    },
    headers: async () => [
      {
        source: '/:path*',
        headers: Object.entries(createSecurityHeaders()).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ],
  };
}
