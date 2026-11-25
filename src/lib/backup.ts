import { createHash } from 'crypto';

/**
 * Backup and disaster recovery module.
 *
 * Implements the automated backup routine for the invoice cache and audit
 * data. Backups are written to a primary storage target and a geo-replica
 * target, verified after upload, and failures are reported via
 * `notifyBackupFailure`.
 *
 * This module is invoked by the scheduler registered in `instrumentation.ts`.
 */

export interface BackupStorageTarget {
  /** Human readable identifier for the storage target. */
  name: string;
  /** Whether this target is the geo-redundant replica. */
  geoReplica?: boolean;
  /** Upload a serialized backup payload and return the stored object key. */
  upload: (key: string, payload: Buffer) => Promise<string>;
  /** Download a previously stored backup payload by key. */
  download: (key: string) => Promise<Buffer>;
  /** Check whether an object exists in the target. */
  exists?: (key: string) => Promise<boolean>;
}

export interface BackupConfig {
  /** Primary storage target. */
  primary: BackupStorageTarget;
  /** Geo-redundant replica storage target. */
  geoReplica: BackupStorageTarget;
  /** Optional prefix for object keys. */
  keyPrefix?: string;
  /** Optional clock override for deterministic tests. */
  now?: () => Date;
}

export interface BackupSnapshot {
  version: number;
  createdAt: string;
  invoiceCache: unknown;
  auditData: unknown;
}

export interface BackupResult {
  success: boolean;
  key: string;
  createdAt: string;
  checksum: string;
  size: number;
  primaryLocation?: string;
  geoReplicaLocation?: string;
  error?: string;
}

export interface RestorationVerificationResult {
  success: boolean;
  key: string;
  checksum: string;
  expectedChecksum?: string;
  size: number;
  snapshot?: BackupSnapshot;
  error?: string;
}

/**
 * Loads the invoice cache data that should be included in the backup.
 * Replace the body with the real data source accessor.
 */
async function loadInvoiceCache(): Promise<unknown> {
  // TODO: wire up to the actual invoice cache store.
  return {};
}

/**
 * Loads the audit data that should be included in the backup.
 * Replace the body with the real data source accessor.
 */
async function loadAuditData(): Promise<unknown> {
  // TODO: wire up to the actual audit data store.
  return {};
}

/**
 * Reports a backup failure to the alerting system.
 * Replace the body with the real alerting integration.
 */
export async function notifyBackupFailure(
  error: Error,
  context: { key?: string; target?: string; phase?: string },
): Promise<void> {
  // TODO: wire up to the alerting/monitoring provider.
  // eslint-disable-next-line no-console
  console.error('[backup] failure', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

function computeChecksum(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

function buildBackupKey(prefix: string | undefined, createdAt: Date): string {
  const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');
  const base = `backups/${timestamp}.json`;
  return prefix ? `${prefix.replace(/\/+$/, '')}/${base}` : base;
}

async function createSnapshot(now: () => Date): Promise<BackupSnapshot> {
  const [invoiceCache, auditData] = await Promise.all([
    loadInvoiceCache(),
    loadAuditData(),
  ]);

  return {
    version: 1,
    createdAt: now().toISOString(),
    invoiceCache,
    auditData,
  };
}

async function uploadAndVerify(
  target: BackupStorageTarget,
  key: string,
  payload: Buffer,
  checksum: string,
): Promise<string> {
  const location = await target.upload(key, payload);

  if (target.exists) {
    const present = await target.exists(key);
    if (!present) {
      throw new Error(`Upload verification failed: object missing at ${target.name}`);
    }
  }

  const downloaded = await target.download(key);
  const downloadedChecksum = computeChecksum(downloaded);
  if (downloadedChecksum !== checksum) {
    throw new Error(
      `Upload verification failed: checksum mismatch at ${target.name}`,
    );
  }

  return location;
}

/**
 * Runs the automated backup routine.
 *
 * Snapshots the invoice cache and audit data, uploads the payload to the
 * primary and geo-replica storage targets, verifies each upload, and reports
 * failures via `notifyBackupFailure`.
 */
export async function runBackup(config: BackupConfig): Promise<BackupResult> {
  const now = config.now ?? (() => new Date());
  const createdAt = now();
  const key = buildBackupKey(config.keyPrefix, createdAt);

  let payload: Buffer;
  let checksum: string;

  try {
    const snapshot = await createSnapshot(now);
    payload = Buffer.from(JSON.stringify(snapshot), 'utf8');
    checksum = computeChecksum(payload);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await notifyBackupFailure(error, { key, phase: 'snapshot' });
    return {
      success: false,
      key,
      createdAt: createdAt.toISOString(),
      checksum: '',
      size: 0,
      error: error.message,
    };
  }

  let primaryLocation: string | undefined;
  let geoReplicaLocation: string | undefined;

  try {
    primaryLocation = await uploadAndVerify(
      config.primary,
      key,
      payload,
      checksum,
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await notifyBackupFailure(error, {
      key,
      target: config.primary.name,
      phase: 'primary-upload',
    });
    return {
      success: false,
      key,
      createdAt: createdAt.toISOString(),
      checksum,
      size: payload.length,
      error: error.message,
    };
  }

  try {
    geoReplicaLocation = await uploadAndVerify(
      config.geoReplica,
      key,
      payload,
      checksum,
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await notifyBackupFailure(error, {
      key,
      target: config.geoReplica.name,
      phase: 'geo-replica-upload',
    });
    return {
      success: false,
      key,
      createdAt: createdAt.toISOString(),
      checksum,
      size: payload.length,
      primaryLocation,
      error: error.message,
    };
  }

  return {
    success: true,
    key,
    createdAt: createdAt.toISOString(),
    checksum,
    size: payload.length,
    primaryLocation,
    geoReplicaLocation,
  };
}

/**
 * Verifies that a backup can be restored from the given storage target.
 *
 * Downloads the backup, validates its checksum (against the expected value
 * when provided), and parses the snapshot. Used by disaster recovery drills.
 */
export async function verifyRestoration(
  target: BackupStorageTarget,
  key: string,
  expectedChecksum?: string,
): Promise<RestorationVerificationResult> {
  try {
    const payload = await target.download(key);
    const checksum = computeChecksum(payload);

    if (expectedChecksum && checksum !== expectedChecksum) {
      return {
        success: false,
        key,
        checksum,
        expectedChecksum,
        size: payload.length,
        error: 'Checksum mismatch during restoration verification',
      };
    }

    let snapshot: BackupSnapshot;
    try {
      snapshot = JSON.parse(payload.toString('utf8')) as BackupSnapshot;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return {
        success: false,
        key,
        checksum,
        expectedChecksum,
        size: payload.length,
        error: `Failed to parse backup payload: ${error.message}`,
      };
    }

    if (
      !snapshot ||
      typeof snapshot !== 'object' ||
      !('invoiceCache' in snapshot) ||
      !('auditData' in snapshot)
    ) {
      return {
        success: false,
        key,
        checksum,
        expectedChecksum,
        size: payload.length,
        error: 'Backup payload is missing required sections',
      };
    }

    return {
      success: true,
      key,
      checksum,
      expectedChecksum,
      size: payload.length,
      snapshot,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      success: false,
      key,
      checksum: '',
      expectedChecksum,
      size: 0,
      error: error.message,
    };
  }
}