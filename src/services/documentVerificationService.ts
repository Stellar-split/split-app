export type DocumentType =
  | 'passport'
  | 'driving-license'
  | 'national-id'
  | 'utility-bill'
  | 'bank-statement'
  | 'invoice';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface Document {
  id: string;
  type: DocumentType;
  ownerId: string;
  fileUrl: string;
  uploadedAt: number;
  expiresAt?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface VerificationRecord {
  id: string;
  documentId: string;
  ownerId: string;
  type: DocumentType;
  status: VerificationStatus;
  startedAt: number;
  completedAt?: number;
  notes?: string;
}

export interface VerificationSummary {
  ownerId: string;
  total: number;
  verified: number;
  rejected: number;
  pending: number;
  expired: number;
}

const SUPPORTED_TYPES: DocumentType[] = [
  'passport',
  'driving-license',
  'national-id',
  'utility-bill',
  'bank-statement',
  'invoice',
];

let counter = 0;
function genId(): string {
  return `vr-${++counter}`;
}

const verificationRecords = new Map<string, VerificationRecord>();

export function isSupportedDocumentType(type: string): type is DocumentType {
  return SUPPORTED_TYPES.includes(type as DocumentType);
}

export function validateDocument(doc: Document, now?: number): ValidationResult {
  const errors: string[] = [];
  const ts = now ?? Date.now();

  if (!doc.id) {
    errors.push('Document id is required');
  }
  if (!doc.ownerId) {
    errors.push('ownerId is required');
  }
  if (!doc.fileUrl || !doc.fileUrl.startsWith('http')) {
    errors.push('fileUrl must be a valid URL starting with http');
  }
  if (!isSupportedDocumentType(doc.type)) {
    errors.push(`Document type '${doc.type}' is not supported`);
  }
  if (doc.expiresAt !== undefined && doc.expiresAt <= ts) {
    errors.push('Document has expired');
  }

  return { valid: errors.length === 0, errors };
}

export function submitDocument(doc: Document, now?: number): VerificationRecord {
  const ts = now ?? Date.now();
  const validation = validateDocument(doc, ts);

  if (!validation.valid) {
    throw new Error('Invalid document: ' + validation.errors.join(', '));
  }

  const record: VerificationRecord = {
    id: genId(),
    documentId: doc.id,
    ownerId: doc.ownerId,
    type: doc.type,
    status: 'pending',
    startedAt: ts,
  };

  verificationRecords.set(record.id, record);
  return record;
}

export function updateVerificationStatus(
  recordId: string,
  status: VerificationStatus,
  notes?: string,
  now?: number,
): VerificationRecord {
  const record = verificationRecords.get(recordId);
  if (!record) {
    throw new Error(`Verification record '${recordId}' not found`);
  }

  const ts = now ?? Date.now();
  const updated: VerificationRecord = {
    ...record,
    status,
    completedAt: ts,
    notes,
  };

  verificationRecords.set(recordId, updated);
  return updated;
}

export function getVerificationRecord(recordId: string): VerificationRecord | undefined {
  return verificationRecords.get(recordId);
}

export function getVerificationsByOwner(ownerId: string): VerificationRecord[] {
  return Array.from(verificationRecords.values()).filter(r => r.ownerId === ownerId);
}

export function getVerificationSummary(ownerId: string): VerificationSummary {
  const records = getVerificationsByOwner(ownerId);

  let verified = 0;
  let rejected = 0;
  let pending = 0;
  let expired = 0;

  for (const r of records) {
    switch (r.status) {
      case 'verified':
        verified++;
        break;
      case 'rejected':
        rejected++;
        break;
      case 'pending':
        pending++;
        break;
      case 'expired':
        expired++;
        break;
    }
  }

  return {
    ownerId,
    total: records.length,
    verified,
    rejected,
    pending,
    expired,
  };
}

export function resetVerificationStore(): void {
  verificationRecords.clear();
  counter = 0;
}
