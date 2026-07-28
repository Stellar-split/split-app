/**
 * Unit tests for template version history logic.
 * Tests are extracted from the pure helper functions used in TemplateManager.
 */

// ---------------------------------------------------------------------------
// Inlined helpers (mirrors the logic in TemplateManager.tsx)
// ---------------------------------------------------------------------------

interface Recipient {
  address: string;
  amount: string;
}

interface TemplateVersion {
  recipients: Recipient[];
  token: string;
  savedAt: string;
}

interface Template {
  name: string;
  recipients: Recipient[];
  token: string;
  versions?: TemplateVersion[];
}

const MAX_VERSIONS = 5;

function pushVersion(template: Template, version: TemplateVersion): TemplateVersion[] {
  const history = template.versions ?? [];
  const updated = [version, ...history];
  if (updated.length > MAX_VERSIONS) {
    updated.length = MAX_VERSIONS;
  }
  return updated;
}

function makeVersion(overrides: Partial<TemplateVersion> = {}): TemplateVersion {
  return {
    recipients: [{ address: "GABC" + "A".repeat(52), amount: "100" }],
    token: "USDC",
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    name: "My Template",
    recipients: [{ address: "GABC" + "A".repeat(52), amount: "100" }],
    token: "USDC",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Version cap enforcement
// ---------------------------------------------------------------------------

describe("pushVersion — version cap enforcement", () => {
  it("keeps the new version as the first entry", () => {
    const t = makeTemplate();
    const newV = makeVersion({ savedAt: "2026-01-01T00:00:00.000Z" });
    const result = pushVersion(t, newV);
    expect(result[0]).toBe(newV);
  });

  it("grows the history up to MAX_VERSIONS", () => {
    let t = makeTemplate();
    for (let i = 0; i < MAX_VERSIONS - 1; i++) {
      t = { ...t, versions: pushVersion(t, makeVersion({ savedAt: `2026-01-0${i + 1}T00:00:00.000Z` })) };
    }
    const newV = makeVersion({ savedAt: "2026-01-10T00:00:00.000Z" });
    const result = pushVersion(t, newV);
    expect(result).toHaveLength(MAX_VERSIONS);
  });

  it("drops the oldest version when the cap is exceeded", () => {
    let t = makeTemplate();
    const oldest = makeVersion({ savedAt: "2025-01-01T00:00:00.000Z" });
    t = { ...t, versions: [oldest] };
    for (let i = 0; i < MAX_VERSIONS - 1; i++) {
      t = { ...t, versions: pushVersion(t, makeVersion()) };
    }
    const result = pushVersion(t, makeVersion());
    expect(result).toHaveLength(MAX_VERSIONS);
    expect(result.map((v) => v.savedAt)).not.toContain(oldest.savedAt);
  });

  it("never exceeds MAX_VERSIONS no matter how many pushes", () => {
    let t = makeTemplate();
    for (let i = 0; i < MAX_VERSIONS * 3; i++) {
      t = { ...t, versions: pushVersion(t, makeVersion()) };
    }
    expect((t.versions ?? []).length).toBeLessThanOrEqual(MAX_VERSIONS);
  });
});

// ---------------------------------------------------------------------------
// Restore creates a new version (not a destructive revert)
// ---------------------------------------------------------------------------

describe("restore — creates a new version rather than mutating history", () => {
  it("makes the restored content the current template without removing existing history", () => {
    const original = makeVersion({ savedAt: "2026-01-01T00:00:00.000Z", token: "USDC" });
    const newer = makeVersion({ savedAt: "2026-02-01T00:00:00.000Z", token: "XLM" });
    let t = makeTemplate({ token: "XLM", versions: [newer, original] });

    // Simulate restore: push current as a version, apply the old one
    const currentAsVersion: TemplateVersion = {
      recipients: t.recipients,
      token: t.token,
      savedAt: new Date().toISOString(),
    };
    const newVersions = pushVersion(t, currentAsVersion);
    t = { ...t, token: original.token, recipients: original.recipients, versions: newVersions };

    // The history now contains the current-before-restore as the newest version
    expect(t.versions?.[0].token).toBe("XLM");
    // The restored content is now current
    expect(t.token).toBe("USDC");
    // Old history entries are still present
    expect(t.versions?.map((v) => v.savedAt)).toContain(newer.savedAt);
  });

  it("history length never decreases after a restore", () => {
    const v1 = makeVersion({ savedAt: "2026-01-01T00:00:00.000Z" });
    const t = makeTemplate({ versions: [v1] });
    const currentAsVersion: TemplateVersion = {
      recipients: t.recipients,
      token: t.token,
      savedAt: new Date().toISOString(),
    };
    const newVersions = pushVersion(t, currentAsVersion);
    expect(newVersions.length).toBeGreaterThanOrEqual((t.versions ?? []).length);
  });
});
