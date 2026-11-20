export interface MultiSigConfig {
  invoiceId: string;
  threshold: number;
  signers: string[];
  highValueThreshold: number;
}

export interface SignerApproval {
  signer: string;
  signature: string;
  approvedAt: string;
  verified: boolean;
}

export interface AuditEntry {
  action: string;
  actor: string;
  timestamp: string;
  details?: string;
}

export interface MultiSigApprovalRecord {
  invoiceId: string;
  config: MultiSigConfig;
  approvals: SignerApproval[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  auditTrail: AuditEntry[];
}

export function requiresMultiSig(amount: number, config: MultiSigConfig): boolean {
  return amount >= config.highValueThreshold && config.signers.length > 0;
}

export function createMultiSigRecord(
  invoiceId: string,
  config: MultiSigConfig,
): MultiSigApprovalRecord {
  const now = new Date().toISOString();
  return {
    invoiceId,
    config,
    approvals: [],
    status: "pending",
    createdAt: now,
    updatedAt: now,
    auditTrail: [
      {
        action: "created",
        actor: "system",
        timestamp: now,
        details: `Multi-sig record created for invoice ${invoiceId}`,
      },
    ],
  };
}

export function addApproval(
  record: MultiSigApprovalRecord,
  signer: string,
  signature: string,
): MultiSigApprovalRecord {
  if (!record.config.signers.includes(signer)) {
    throw new Error("Signer not authorized");
  }
  if (record.approvals.some((a) => a.signer === signer)) {
    throw new Error("Signer already approved");
  }

  const now = new Date().toISOString();
  const verified = signature.length > 0;

  const newApproval: SignerApproval = {
    signer,
    signature,
    approvedAt: now,
    verified,
  };

  const updatedApprovals = [...record.approvals, newApproval];
  const isApproved = updatedApprovals.length >= record.config.threshold;

  const auditEntry: AuditEntry = {
    action: "approved",
    actor: signer,
    timestamp: now,
    details: `Signer ${signer} approved invoice ${record.invoiceId}`,
  };

  return {
    ...record,
    approvals: updatedApprovals,
    status: isApproved ? "approved" : "pending",
    updatedAt: now,
    auditTrail: [...record.auditTrail, auditEntry],
  };
}

export function getApprovalProgress(record: MultiSigApprovalRecord): {
  approved: number;
  required: number;
  remaining: number;
  isComplete: boolean;
} {
  const approved = record.approvals.filter((a) => a.verified).length;
  const required = record.config.threshold;
  const remaining = Math.max(0, required - approved);
  return { approved, required, remaining, isComplete: approved >= required };
}

export function getAuditTrail(record: MultiSigApprovalRecord): AuditEntry[] {
  return record.auditTrail;
}

export function notifySigners(record: MultiSigApprovalRecord, pendingSigners: string[]): void {
  for (const addr of pendingSigners) {
    console.log(`Notifying signer ${addr} for invoice ${record.invoiceId}`);
  }
}

export function configureThreshold(
  invoiceId: string,
  signers: string[],
  threshold: number,
  highValueThreshold = 0,
): MultiSigConfig {
  if (threshold > signers.length) {
    throw new Error("Threshold cannot exceed number of signers");
  }
  return { invoiceId, threshold, signers, highValueThreshold };
}
