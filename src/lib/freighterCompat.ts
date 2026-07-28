/**
 * Freighter wallet compatibility matrix and version management
 */

export interface FreighterVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface CompatibilityInfo {
  minVersion: FreighterVersion;
  deprecatedVersions: FreighterVersion[];
  breakingChanges: Record<string, string>; // version -> description
}

// Define minimum supported version
const MINIMUM_VERSION: FreighterVersion = {
  major: 4,
  minor: 0,
  patch: 0,
};

// Define deprecated versions
const DEPRECATED_VERSIONS: FreighterVersion[] = [
  { major: 2, minor: 0, patch: 0 },
  { major: 3, minor: 0, patch: 0 },
];

// Breaking changes documentation
const BREAKING_CHANGES: Record<string, string> = {
  '4.0.0':
    'API signature changed for signTransaction(). Use new format: signTransaction(xdr, { network, networkPassphrase })',
  '5.0.0':
    'The getNetwork() method now returns network details as an object instead of a string. Use getNetworkDetails() instead.',
};

export const FREIGHTER_COMPAT: CompatibilityInfo = {
  minVersion: MINIMUM_VERSION,
  deprecatedVersions: DEPRECATED_VERSIONS,
  breakingChanges: BREAKING_CHANGES,
};

/**
 * Parse version string into version object
 */
export function parseVersion(versionString: string): FreighterVersion | null {
  try {
    const parts = versionString.split('.');
    if (parts.length < 3) return null;

    return {
      major: parseInt(parts[0], 10),
      minor: parseInt(parts[1], 10),
      patch: parseInt(parts[2], 10),
    };
  } catch {
    return null;
  }
}

/**
 * Format version object to string
 */
export function formatVersion(version: FreighterVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: FreighterVersion, b: FreighterVersion): number {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return 0;
}

/**
 * Check if version is supported
 */
export function isVersionSupported(version: FreighterVersion): boolean {
  return compareVersions(version, MINIMUM_VERSION) >= 0;
}

/**
 * Check if version is deprecated
 */
export function isVersionDeprecated(version: FreighterVersion): boolean {
  return DEPRECATED_VERSIONS.some((deprecated) => compareVersions(version, deprecated) === 0);
}

/**
 * Get breaking changes for a version
 */
export function getBreakingChangesForVersion(version: FreighterVersion): string | null {
  const versionKey = formatVersion(version);
  return BREAKING_CHANGES[versionKey] || null;
}

/**
 * Get compatibility status message
 */
export function getCompatibilityStatus(
  version: FreighterVersion | null
): {
  status: 'unknown' | 'compatible' | 'deprecated' | 'unsupported';
  message: string;
  canContinue: boolean;
  breakingChange?: string;
} {
  if (!version) {
    return {
      status: 'unknown',
      message: 'Could not detect Freighter version',
      canContinue: false,
    };
  }

  if (!isVersionSupported(version)) {
    return {
      status: 'unsupported',
      message: `Freighter ${formatVersion(version)} is not supported. Please upgrade to ${formatVersion(MINIMUM_VERSION)} or later.`,
      canContinue: false,
    };
  }

  if (isVersionDeprecated(version)) {
    const breakingChange = getBreakingChangesForVersion(version);
    return {
      status: 'deprecated',
      message: `You are using Freighter ${formatVersion(version)}, which is deprecated. Please upgrade to version ${formatVersion(MINIMUM_VERSION)} or later.`,
      canContinue: true,
      breakingChange: breakingChange || undefined,
    };
  }

  return {
    status: 'compatible',
    message: `Freighter ${formatVersion(version)} is compatible`,
    canContinue: true,
  };
}

/**
 * Chrome Web Store link for upgrading Freighter
 */
export const FREIGHTER_UPGRADE_URL =
  'https://chrome.google.com/webstore/detail/freighter/bcchcodsuefbhighdickefkmmnkfbafh';
