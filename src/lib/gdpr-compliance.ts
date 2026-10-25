export enum DataResidency {
  EU = 'EU',
  US = 'US',
  APAC = 'APAC',
  AUTO = 'AUTO',
}

export enum ConsentType {
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
  NECESSARY = 'necessary',
  FUNCTIONAL = 'functional',
  PERFORMANCE = 'performance',
}

export interface UserConsent {
  userId: string;
  consentTypes: Map<ConsentType, boolean>;
  givenAt: Date;
  expiresAt?: Date;
  ipAddress: string;
}

export interface DataPortabilityRequest {
  userId: string;
  format: 'json' | 'csv' | 'xml';
  requestedAt: Date;
  completedAt?: Date;
  dataUrl?: string;
  expiresAt: Date;
}

export interface RightToBeForgettenRequest {
  userId: string;
  requestedAt: Date;
  reason: string;
  completedAt?: Date;
  verificationToken: string;
  verified: boolean;
}

export interface ComplianceAuditLog {
  id: string;
  action: string;
  userId?: string;
  dataCategory: string;
  timestamp: Date;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

export class GDPRComplianceManager {
  private consents: Map<string, UserConsent> = new Map();
  private dataPortabilityRequests: Map<string, DataPortabilityRequest> = new Map();
  private rtbfRequests: Map<string, RightToBeForgettenRequest> = new Map();
  private auditLogs: ComplianceAuditLog[] = [];
  private dataResidency: DataResidency;

  constructor(residency: DataResidency = DataResidency.AUTO) {
    this.dataResidency = residency;
  }

  recordConsent(userId: string, consents: Map<ConsentType, boolean>, ipAddress: string): void {
    const userConsent: UserConsent = {
      userId,
      consentTypes: new Map(consents),
      givenAt: new Date(),
      ipAddress,
    };

    this.consents.set(userId, userConsent);
    this.logAuditEvent({
      action: 'CONSENT_GIVEN',
      userId,
      dataCategory: 'CONSENT',
      details: { consents: Object.fromEntries(consents) },
      ipAddress,
    });
  }

  getConsent(userId: string, consentType: ConsentType): boolean {
    const consent = this.consents.get(userId);
    if (!consent) return false;
    return consent.consentTypes.get(consentType) || false;
  }

  requestDataPortability(userId: string, format: 'json' | 'csv' | 'xml', ipAddress: string): string {
    const requestId = this.generateRequestId();
    const request: DataPortabilityRequest = {
      userId,
      format,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };

    this.dataPortabilityRequests.set(requestId, request);
    this.logAuditEvent({
      action: 'DATA_PORTABILITY_REQUESTED',
      userId,
      dataCategory: 'DATA_EXPORT',
      details: { format },
      ipAddress,
    });

    return requestId;
  }

  completeDataPortability(requestId: string, dataUrl: string): void {
    const request = this.dataPortabilityRequests.get(requestId);
    if (!request) throw new Error('Request not found');

    request.completedAt = new Date();
    request.dataUrl = dataUrl;

    this.logAuditEvent({
      action: 'DATA_PORTABILITY_COMPLETED',
      userId: request.userId,
      dataCategory: 'DATA_EXPORT',
      details: { requestId },
      ipAddress: '',
    });
  }

  requestRightToBeForgotten(userId: string, reason: string, ipAddress: string): string {
    const verificationToken = this.generateVerificationToken();
    const requestId = this.generateRequestId();

    const rtbfRequest: RightToBeForgettenRequest = {
      userId,
      requestedAt: new Date(),
      reason,
      verificationToken,
      verified: false,
    };

    this.rtbfRequests.set(requestId, rtbfRequest);
    this.logAuditEvent({
      action: 'RTBF_REQUESTED',
      userId,
      dataCategory: 'DATA_DELETION',
      details: { reason },
      ipAddress,
    });

    return requestId;
  }

  verifyRightToBeForgotten(requestId: string, token: string): boolean {
    const request = this.rtbfRequests.get(requestId);
    if (!request || request.verified) return false;
    if (request.verificationToken !== token) return false;

    request.verified = true;
    request.completedAt = new Date();

    this.logAuditEvent({
      action: 'RTBF_VERIFIED',
      userId: request.userId,
      dataCategory: 'DATA_DELETION',
      details: { requestId },
      ipAddress: '',
    });

    return true;
  }

  getAuditLog(filters?: { userId?: string; action?: string; startDate?: Date; endDate?: Date }): ComplianceAuditLog[] {
    return this.auditLogs.filter((log) => {
      if (filters?.userId && log.userId !== filters.userId) return false;
      if (filters?.action && log.action !== filters.action) return false;
      if (filters?.startDate && log.timestamp < filters.startDate) return false;
      if (filters?.endDate && log.timestamp > filters.endDate) return false;
      return true;
    });
  }

  generateComplianceReport(userId: string): Record<string, unknown> {
    return {
      userId,
      consentStatus: this.consents.get(userId)?.consentTypes,
      auditLog: this.getAuditLog({ userId }),
      dataResidency: this.dataResidency,
      reportGeneratedAt: new Date(),
    };
  }

  private logAuditEvent(event: Omit<ComplianceAuditLog, 'id' | 'timestamp'>): void {
    const log: ComplianceAuditLog = {
      ...event,
      id: this.generateRequestId(),
      timestamp: new Date(),
      userAgent: '',
    };
    this.auditLogs.push(log);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVerificationToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  setDataResidency(residency: DataResidency): void {
    this.dataResidency = residency;
  }

  getDataResidency(): DataResidency {
    return this.dataResidency;
  }
}
