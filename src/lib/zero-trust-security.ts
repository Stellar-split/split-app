export enum TrustLevel {
  UNTRUSTED = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  VERIFIED = 4,
}

export enum AccessContext {
  LOCATION = 'location',
  TIME = 'time',
  DEVICE = 'device',
  NETWORK = 'network',
  BEHAVIOR = 'behavior',
  MFA_STATUS = 'mfa_status',
  RISK_SCORE = 'risk_score',
}

export interface Identity {
  userId: string;
  verified: boolean;
  verificationMethods: string[];
  verificationTimestamp: Date;
  riskScore: number; // 0-100
}

export interface DeviceInfo {
  deviceId: string;
  deviceType: string;
  osVersion: string;
  appVersion: string;
  lastSeen: Date;
  trusted: boolean;
  encryptionEnabled: boolean;
  locationConsent: boolean;
}

export interface AccessPolicy {
  id: string;
  name: string;
  resource: string;
  action: string;
  requiredTrustLevel: TrustLevel;
  contextRequirements: Map<AccessContext, unknown>;
  mfaRequired: boolean;
  allowedNetworks: string[];
  timeRestrictions?: { startTime: number; endTime: number }; // Unix timestamps
  maxRiskScore: number; // 0-100
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  trustLevel: TrustLevel;
  contextScores: Map<AccessContext, number>;
  additionalFactorsRequired: string[];
  expiresAt?: Date;
}

export class ZeroTrustSecurityManager {
  private identities: Map<string, Identity> = new Map();
  private devices: Map<string, DeviceInfo> = new Map();
  private policies: Map<string, AccessPolicy> = new Map();
  private accessLog: AccessAttempt[] = [];
  private behavioralProfiles: Map<string, BehavioralProfile> = new Map();

  registerIdentity(userId: string, verificationMethods: string[]): void {
    const identity: Identity = {
      userId,
      verified: false,
      verificationMethods,
      verificationTimestamp: new Date(),
      riskScore: 50, // Start with medium risk
    };

    this.identities.set(userId, identity);
  }

  verifyIdentity(userId: string, method: string, success: boolean): void {
    const identity = this.identities.get(userId);
    if (!identity) throw new Error('Identity not found');

    if (success && identity.verificationMethods.includes(method)) {
      identity.verified = true;
      identity.verificationTimestamp = new Date();
      identity.riskScore = Math.max(0, identity.riskScore - 10);
    } else {
      identity.riskScore = Math.min(100, identity.riskScore + 20);
    }
  }

  registerDevice(deviceId: string, deviceInfo: Omit<DeviceInfo, 'lastSeen' | 'trusted'>): void {
    const device: DeviceInfo = {
      ...deviceInfo,
      deviceId,
      lastSeen: new Date(),
      trusted: false,
    };

    this.devices.set(deviceId, device);
  }

  verifyDevice(deviceId: string, checks: DeviceVerificationChecks): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    const trustScore = this.calculateDeviceTrust(device, checks);
    device.trusted = trustScore >= 70;
    device.lastSeen = new Date();

    return device.trusted;
  }

  createAccessPolicy(
    name: string,
    resource: string,
    action: string,
    requiredTrustLevel: TrustLevel
  ): string {
    const policyId = this.generatePolicyId();
    const policy: AccessPolicy = {
      id: policyId,
      name,
      resource,
      action,
      requiredTrustLevel,
      contextRequirements: new Map(),
      mfaRequired: requiredTrustLevel >= TrustLevel.HIGH,
      allowedNetworks: [],
      maxRiskScore: 100 - requiredTrustLevel * 10,
    };

    this.policies.set(policyId, policy);
    return policyId;
  }

  addContextRequirement(policyId: string, context: AccessContext, requirement: unknown): void {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error('Policy not found');

    policy.contextRequirements.set(context, requirement);
  }

  checkAccess(userId: string, deviceId: string, resource: string, action: string, context: AccessContext[]): AccessDecision {
    const identity = this.identities.get(userId);
    const device = this.devices.get(deviceId);

    if (!identity || !device) {
      return {
        allowed: false,
        reason: 'Identity or device not found',
        trustLevel: TrustLevel.UNTRUSTED,
        contextScores: new Map(),
        additionalFactorsRequired: ['identity_verification', 'device_verification'],
      };
    }

    const policies = Array.from(this.policies.values()).filter(
      (p) => p.resource === resource && p.action === action
    );

    if (policies.length === 0) {
      return {
        allowed: false,
        reason: 'No access policy defined for this resource/action',
        trustLevel: TrustLevel.UNTRUSTED,
        contextScores: new Map(),
        additionalFactorsRequired: [],
      };
    }

    const policy = policies[0];
    const trustLevel = this.calculateTrustLevel(identity, device, policy, context);
    const contextScores = this.evaluateContext(identity, device, policy, context);
    const additionalFactorsRequired = this.getRequiredFactors(trustLevel, policy, device);

    const allowed =
      trustLevel >= policy.requiredTrustLevel &&
      identity.riskScore <= policy.maxRiskScore &&
      (!policy.mfaRequired || device.encryptionEnabled);

    this.logAccessAttempt(userId, deviceId, resource, action, allowed, trustLevel);

    return {
      allowed,
      reason: allowed ? 'Access granted' : 'Insufficient trust level',
      trustLevel,
      contextScores,
      additionalFactorsRequired,
      expiresAt: allowed ? new Date(Date.now() + 60 * 60 * 1000) : undefined, // 1 hour session
    };
  }

  private calculateTrustLevel(
    identity: Identity,
    device: DeviceInfo,
    policy: AccessPolicy,
    contexts: AccessContext[]
  ): TrustLevel {
    let trustLevel = TrustLevel.UNTRUSTED;

    if (identity.verified) trustLevel += 1;
    if (device.trusted) trustLevel += 1;
    if (device.encryptionEnabled) trustLevel += 1;
    if (identity.riskScore < 30) trustLevel += 1;

    return Math.min(TrustLevel.VERIFIED, trustLevel);
  }

  private evaluateContext(
    identity: Identity,
    device: DeviceInfo,
    policy: AccessPolicy,
    contexts: AccessContext[]
  ): Map<AccessContext, number> {
    const scores = new Map<AccessContext, number>();

    for (const context of contexts) {
      const requirement = policy.contextRequirements.get(context);
      let score = 0;

      switch (context) {
        case AccessContext.LOCATION:
          score = device.locationConsent ? 80 : 20;
          break;
        case AccessContext.DEVICE:
          score = device.trusted ? 90 : 30;
          break;
        case AccessContext.MFA_STATUS:
          score = device.encryptionEnabled ? 95 : 40;
          break;
        case AccessContext.RISK_SCORE:
          score = 100 - identity.riskScore;
          break;
        default:
          score = 50;
      }

      scores.set(context, score);
    }

    return scores;
  }

  private calculateDeviceTrust(device: DeviceInfo, checks: DeviceVerificationChecks): number {
    let score = 0;

    if (checks.osSignatureValid) score += 20;
    if (checks.encryptionEnabled) score += 20;
    if (checks.noMalware) score += 20;
    if (checks.updated) score += 20;
    if (checks.pinned) score += 20;

    return score;
  }

  private getRequiredFactors(trustLevel: TrustLevel, policy: AccessPolicy, device: DeviceInfo): string[] {
    const factors: string[] = [];

    if (trustLevel < policy.requiredTrustLevel) {
      factors.push('increase_trust_level');
    }

    if (policy.mfaRequired && !device.encryptionEnabled) {
      factors.push('enable_encryption');
      factors.push('mfa_verification');
    }

    return factors;
  }

  private logAccessAttempt(
    userId: string,
    deviceId: string,
    resource: string,
    action: string,
    allowed: boolean,
    trustLevel: TrustLevel
  ): void {
    this.accessLog.push({
      timestamp: new Date(),
      userId,
      deviceId,
      resource,
      action,
      allowed,
      trustLevel,
    });
  }

  private generatePolicyId(): string {
    return `pol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  recordBehavior(userId: string, behavior: string, timestamp: Date = new Date()): void {
    if (!this.behavioralProfiles.has(userId)) {
      this.behavioralProfiles.set(userId, {
        userId,
        behaviors: [],
        anomalyScores: [],
      });
    }

    const profile = this.behavioralProfiles.get(userId)!;
    profile.behaviors.push({ behavior, timestamp });

    const anomalyScore = this.calculateAnomalyScore(profile);
    profile.anomalyScores.push(anomalyScore);
  }

  private calculateAnomalyScore(profile: BehavioralProfile): number {
    if (profile.behaviors.length < 10) return 0;

    // Simplified anomaly detection
    const recentBehaviors = profile.behaviors.slice(-10);
    const uniqueBehaviors = new Set(recentBehaviors.map((b) => b.behavior));

    return uniqueBehaviors.size > 5 ? 75 : 25; // High variance = anomaly
  }

  getSecurityMonitoring(userId: string) {
    const identity = this.identities.get(userId);
    const profile = this.behavioralProfiles.get(userId);
    const userAccess = this.accessLog.filter((log) => log.userId === userId);

    return {
      riskScore: identity?.riskScore || 50,
      anomalyScore: profile?.anomalyScores[profile.anomalyScores.length - 1] || 0,
      recentAccess: userAccess.slice(-10),
      anomalies: userAccess.filter((log) => !log.allowed),
    };
  }
}

interface DeviceVerificationChecks {
  osSignatureValid: boolean;
  encryptionEnabled: boolean;
  noMalware: boolean;
  updated: boolean;
  pinned: boolean;
}

interface AccessAttempt {
  timestamp: Date;
  userId: string;
  deviceId: string;
  resource: string;
  action: string;
  allowed: boolean;
  trustLevel: TrustLevel;
}

interface BehavioralProfile {
  userId: string;
  behaviors: Array<{ behavior: string; timestamp: Date }>;
  anomalyScores: number[];
}
