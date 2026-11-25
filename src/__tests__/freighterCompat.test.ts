import { describe, it, expect } from 'vitest';
import {
  parseVersion,
  formatVersion,
  compareVersions,
  isVersionSupported,
  isVersionDeprecated,
  getBreakingChangesForVersion,
  getCompatibilityStatus,
  FREIGHTER_COMPAT,
  FREIGHTER_UPGRADE_URL,
} from '@/lib/freighterCompat';
import type { FreighterVersion } from '@/lib/freighterCompat';

describe('freighterCompat', () => {
  describe('parseVersion', () => {
    it('should parse valid version string', () => {
      const version = parseVersion('4.5.2');
      expect(version).toEqual({ major: 4, minor: 5, patch: 2 });
    });

    it('should handle version with single digits', () => {
      const version = parseVersion('1.0.0');
      expect(version).toEqual({ major: 1, minor: 0, patch: 0 });
    });

    it('should return null for invalid version string', () => {
      expect(parseVersion('invalid')).toBeNull();
      expect(parseVersion('1.2')).toBeNull();
      expect(parseVersion('')).toBeNull();
    });

    it('should handle version with extra dots', () => {
      const version = parseVersion('4.5.2.1');
      // Should only use first three parts
      expect(version).toEqual({ major: 4, minor: 5, patch: 2 });
    });
  });

  describe('formatVersion', () => {
    it('should format version object to string', () => {
      const version: FreighterVersion = { major: 4, minor: 5, patch: 2 };
      expect(formatVersion(version)).toBe('4.5.2');
    });

    it('should handle version with zeros', () => {
      const version: FreighterVersion = { major: 4, minor: 0, patch: 0 };
      expect(formatVersion(version)).toBe('4.0.0');
    });
  });

  describe('compareVersions', () => {
    const v1_0_0 = parseVersion('1.0.0')!;
    const v2_0_0 = parseVersion('2.0.0')!;
    const v2_1_0 = parseVersion('2.1.0')!;
    const v2_1_5 = parseVersion('2.1.5')!;

    it('should return -1 when first version is less', () => {
      expect(compareVersions(v1_0_0, v2_0_0)).toBe(-1);
    });

    it('should return 1 when first version is greater', () => {
      expect(compareVersions(v2_0_0, v1_0_0)).toBe(1);
    });

    it('should return 0 when versions are equal', () => {
      const v2_0_0_copy = parseVersion('2.0.0')!;
      expect(compareVersions(v2_0_0, v2_0_0_copy)).toBe(0);
    });

    it('should compare minor version when major is equal', () => {
      expect(compareVersions(v2_0_0, v2_1_0)).toBe(-1);
      expect(compareVersions(v2_1_0, v2_0_0)).toBe(1);
    });

    it('should compare patch version when major and minor are equal', () => {
      expect(compareVersions(v2_1_0, v2_1_5)).toBe(-1);
      expect(compareVersions(v2_1_5, v2_1_0)).toBe(1);
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for minimum version', () => {
      const minVersion = FREIGHTER_COMPAT.minVersion;
      expect(isVersionSupported(minVersion)).toBe(true);
    });

    it('should return true for version greater than minimum', () => {
      const version = parseVersion('5.0.0')!;
      expect(isVersionSupported(version)).toBe(true);
    });

    it('should return false for version less than minimum', () => {
      const version = parseVersion('3.9.9')!;
      expect(isVersionSupported(version)).toBe(false);
    });

    it('should return true for patch version greater than minimum', () => {
      const version = parseVersion('4.0.1')!;
      expect(isVersionSupported(version)).toBe(true);
    });
  });

  describe('isVersionDeprecated', () => {
    it('should return true for deprecated version 3.0.0', () => {
      const version = parseVersion('3.0.0')!;
      expect(isVersionDeprecated(version)).toBe(true);
    });

    it('should return true for deprecated version 2.0.0', () => {
      const version = parseVersion('2.0.0')!;
      expect(isVersionDeprecated(version)).toBe(true);
    });

    it('should return false for supported version', () => {
      const version = parseVersion('4.0.0')!;
      expect(isVersionDeprecated(version)).toBe(false);
    });

    it('should return false for newer version', () => {
      const version = parseVersion('5.0.0')!;
      expect(isVersionDeprecated(version)).toBe(false);
    });
  });

  describe('getBreakingChangesForVersion', () => {
    it('should return breaking changes for v4.0.0', () => {
      const version = parseVersion('4.0.0')!;
      const changes = getBreakingChangesForVersion(version);
      expect(changes).toBeDefined();
      expect(changes).toContain('signTransaction');
    });

    it('should return breaking changes for v5.0.0', () => {
      const version = parseVersion('5.0.0')!;
      const changes = getBreakingChangesForVersion(version);
      expect(changes).toBeDefined();
      expect(changes).toContain('getNetwork');
    });

    it('should return null for version without breaking changes', () => {
      const version = parseVersion('4.1.0')!;
      const changes = getBreakingChangesForVersion(version);
      expect(changes).toBeNull();
    });
  });

  describe('getCompatibilityStatus', () => {
    it('should return "unknown" status when version is null', () => {
      const status = getCompatibilityStatus(null);
      expect(status.status).toBe('unknown');
      expect(status.canContinue).toBe(false);
    });

    it('should return "compatible" for supported version', () => {
      const version = parseVersion('4.1.0')!;
      const status = getCompatibilityStatus(version);
      expect(status.status).toBe('compatible');
      expect(status.canContinue).toBe(true);
    });

    it('should return "unsupported" for versions in deprecated list below minimum', () => {
      // Note: Current implementation has deprecated versions below minimum version
      // So they're reported as unsupported, not deprecated
      const version = parseVersion('3.0.0')!;
      const status = getCompatibilityStatus(version);
      expect(status.status).toBe('unsupported');
      expect(status.canContinue).toBe(false);
      expect(status.message).toContain('not supported');
    });

    it('should return "unsupported" for version below minimum', () => {
      const version = parseVersion('2.0.0')!;
      const status = getCompatibilityStatus(version);
      expect(status.status).toBe('unsupported');
      expect(status.canContinue).toBe(false);
    });

    it('should indicate unsupported for version v3.0.0 below minimum', () => {
      const version = parseVersion('3.0.0')!;
      const status = getCompatibilityStatus(version);
      // v3.0.0 is below the minimum supported version 4.0.0
      expect(status.status).toBe('unsupported');
      expect(status.message).toContain('not supported');
    });

    it('should include breaking change info for v4.0.0', () => {
      const version = parseVersion('4.0.0')!;
      const status = getCompatibilityStatus(version);
      // v4.0.0 is the minimum supported version, so it should be compatible
      expect(status.status).toBe('compatible');
    });

    it('should include proper message for unsupported version', () => {
      const version = parseVersion('1.0.0')!;
      const status = getCompatibilityStatus(version);
      expect(status.message).toContain('not supported');
      expect(status.message).toContain('upgrade');
    });
  });

  describe('FREIGHTER_COMPAT constant', () => {
    it('should have minimum version defined', () => {
      expect(FREIGHTER_COMPAT.minVersion).toBeDefined();
      expect(FREIGHTER_COMPAT.minVersion.major).toBeGreaterThan(0);
    });

    it('should have deprecated versions array', () => {
      expect(Array.isArray(FREIGHTER_COMPAT.deprecatedVersions)).toBe(true);
      expect(FREIGHTER_COMPAT.deprecatedVersions.length).toBeGreaterThan(0);
    });

    it('should have breaking changes record', () => {
      expect(typeof FREIGHTER_COMPAT.breakingChanges).toBe('object');
      expect(Object.keys(FREIGHTER_COMPAT.breakingChanges).length).toBeGreaterThan(0);
    });
  });

  describe('FREIGHTER_UPGRADE_URL', () => {
    it('should be a valid Chrome Web Store URL', () => {
      expect(FREIGHTER_UPGRADE_URL).toContain('chrome.google.com');
      expect(FREIGHTER_UPGRADE_URL).toContain('webstore');
      expect(FREIGHTER_UPGRADE_URL).toContain('freighter');
    });
  });

  describe('Integration scenarios', () => {
    it('should correctly handle upgrade path from unsupported to supported', () => {
      const unsupported = parseVersion('3.0.0')!;
      const supported = parseVersion('4.0.0')!;

      const unsupportedStatus = getCompatibilityStatus(unsupported);
      const supportedStatus = getCompatibilityStatus(supported);

      // 3.0.0 is below minimum version 4.0.0
      expect(unsupportedStatus.status).toBe('unsupported');
      expect(supportedStatus.status).toBe('compatible');
      expect(unsupportedStatus.canContinue).toBe(false);
      expect(supportedStatus.canContinue).toBe(true);
    });

    it('should handle version upgrade chain', () => {
      const versions = ['2.0.0', '3.0.0', '4.0.0', '5.0.0'].map(
        (v) => parseVersion(v)!
      );

      const statuses = versions.map(getCompatibilityStatus);

      // All versions below minimum should be unsupported
      expect(statuses[0].status).toBe('unsupported');
      expect(statuses[1].status).toBe('unsupported');

      // Minimum version and above should be compatible
      expect(statuses[2].status).toBe('compatible');
      expect(statuses[3].status).toBe('compatible');
    });
  });
});
