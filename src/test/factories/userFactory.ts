/**
 * User (wallet-holder) test data factory. See src/test/factories/README.md.
 */

export interface TestUser {
  id: string;
  walletAddress: string;
  displayName: string;
  email: string | null;
  isVerified: boolean;
  createdAt: number;
}

let userSequence = 0;

export function resetUserFactorySequence(): void {
  userSequence = 0;
}

function nextUserSequence(): number {
  userSequence += 1;
  return userSequence;
}

function fakeStellarAddress(seed: number): string {
  return `G${"USERFAC".padEnd(55, String(seed % 10))}`.slice(0, 56);
}

/**
 * Builds a single user with sensible defaults, overridable per field.
 *
 * @example
 *   const user = buildUser({ isVerified: true, displayName: "Alice" });
 */
export function buildUser(overrides: Partial<TestUser> = {}): TestUser {
  const n = nextUserSequence();

  return {
    id: `user-${n}`,
    walletAddress: fakeStellarAddress(n),
    displayName: `Test User ${n}`,
    email: `test-user-${n}@example.test`,
    isVerified: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

export function buildUserList(count: number, overrides: Partial<TestUser> = {}): TestUser[] {
  return Array.from({ length: count }, () => buildUser(overrides));
}

/** Common fixtures for user states. */
export const userFixtures = {
  unverified: () => buildUser({ isVerified: false }),
  verified: () => buildUser({ isVerified: true }),
  anonymous: () => buildUser({ email: null, displayName: "Anonymous" }),
};
