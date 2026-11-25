import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateDocument,
  submitDocument,
  updateVerificationStatus,
  getVerificationRecord,
  getVerificationsByOwner,
  getVerificationSummary,
  isSupportedDocumentType,
  resetVerificationStore,
} from '@/services/documentVerificationService';
import type { Document } from '@/services/documentVerificationService';

const baseDoc: Document = {
  id: 'doc-1',
  type: 'passport',
  ownerId: 'user-1',
  fileUrl: 'https://storage.example.com/doc-1.pdf',
  uploadedAt: Date.now(),
};

beforeEach(() => {
  resetVerificationStore();
});

describe('documentVerificationService', () => {
  describe('isSupportedDocumentType', () => {
    it('accepts valid document types', () => {
      expect(isSupportedDocumentType('passport')).toBe(true);
      expect(isSupportedDocumentType('driving-license')).toBe(true);
      expect(isSupportedDocumentType('national-id')).toBe(true);
      expect(isSupportedDocumentType('utility-bill')).toBe(true);
      expect(isSupportedDocumentType('bank-statement')).toBe(true);
      expect(isSupportedDocumentType('invoice')).toBe(true);
    });

    it('rejects unknown types', () => {
      expect(isSupportedDocumentType('selfie')).toBe(false);
      expect(isSupportedDocumentType('')).toBe(false);
    });
  });

  describe('validateDocument', () => {
    it('passes for a valid document', () => {
      const result = validateDocument(baseDoc);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('errors on missing id', () => {
      const result = validateDocument({ ...baseDoc, id: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /id/i.test(e))).toBe(true);
    });

    it('errors on missing ownerId', () => {
      const result = validateDocument({ ...baseDoc, ownerId: '' });
      expect(result.valid).toBe(false);
    });

    it('errors on invalid fileUrl', () => {
      const result = validateDocument({ ...baseDoc, fileUrl: 'not-a-url' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /url/i.test(e))).toBe(true);
    });

    it('errors on unsupported document type', () => {
      const result = validateDocument({ ...baseDoc, type: 'selfie' as any });
      expect(result.valid).toBe(false);
    });

    it('errors on expired document', () => {
      const past = Date.now() - 1000;
      const result = validateDocument({ ...baseDoc, expiresAt: past }, Date.now());
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => /expir/i.test(e))).toBe(true);
    });

    it('passes for non-expired document', () => {
      const future = Date.now() + 86_400_000;
      const result = validateDocument({ ...baseDoc, expiresAt: future }, Date.now());
      expect(result.valid).toBe(true);
    });
  });

  describe('submitDocument', () => {
    it('creates a pending verification record', () => {
      const record = submitDocument(baseDoc);
      expect(record.status).toBe('pending');
      expect(record.documentId).toBe(baseDoc.id);
      expect(record.ownerId).toBe(baseDoc.ownerId);
      expect(record.type).toBe(baseDoc.type);
      expect(record.id).toBeTruthy();
    });

    it('throws for invalid document', () => {
      expect(() => submitDocument({ ...baseDoc, fileUrl: 'bad-url' })).toThrow(/invalid document/i);
    });
  });

  describe('updateVerificationStatus', () => {
    it('updates to verified', () => {
      const record = submitDocument(baseDoc);
      const updated = updateVerificationStatus(record.id, 'verified', 'All good');
      expect(updated.status).toBe('verified');
      expect(updated.notes).toBe('All good');
      expect(updated.completedAt).toBeDefined();
    });

    it('updates to rejected', () => {
      const record = submitDocument(baseDoc);
      const updated = updateVerificationStatus(record.id, 'rejected', 'Fake document');
      expect(updated.status).toBe('rejected');
    });

    it('throws for unknown record', () => {
      expect(() => updateVerificationStatus('no-such-id', 'verified')).toThrow();
    });
  });

  describe('getVerificationRecord', () => {
    it('retrieves by id', () => {
      const record = submitDocument(baseDoc);
      const found = getVerificationRecord(record.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(record.id);
    });

    it('returns undefined for unknown id', () => {
      expect(getVerificationRecord('ghost')).toBeUndefined();
    });
  });

  describe('getVerificationsByOwner', () => {
    it('returns all records for an owner', () => {
      submitDocument(baseDoc);
      submitDocument({ ...baseDoc, id: 'doc-2', type: 'driving-license' });
      const records = getVerificationsByOwner('user-1');
      expect(records).toHaveLength(2);
    });

    it('returns empty array for unknown owner', () => {
      expect(getVerificationsByOwner('ghost')).toEqual([]);
    });
  });

  describe('getVerificationSummary', () => {
    it('returns correct counts', () => {
      const r1 = submitDocument(baseDoc);
      const r2 = submitDocument({ ...baseDoc, id: 'doc-2', type: 'national-id' });
      const r3 = submitDocument({ ...baseDoc, id: 'doc-3', type: 'invoice' });
      updateVerificationStatus(r1.id, 'verified');
      updateVerificationStatus(r2.id, 'rejected');
      // r3 stays pending
      const summary = getVerificationSummary('user-1');
      expect(summary.total).toBe(3);
      expect(summary.verified).toBe(1);
      expect(summary.rejected).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.expired).toBe(0);
    });
  });
});
