import { can, revokeGrant, upsertGrant, type ShareGrant } from "@/lib/sharePermissions";

const OWNER = "GOWNER";
const EDITOR = "GEDITOR";
const base: ShareGrant[] = [
  { address: OWNER, role: "owner", grantedAt: 0 },
  { address: EDITOR, role: "editor", grantedAt: 0 },
];

describe("sharePermissions", () => {
  it("resolves role permissions with allow/deny overrides", () => {
    expect(can(base, EDITOR, "edit")).toBe(true);
    expect(can(base, EDITOR, "cancel")).toBe(false);
    const g = upsertGrant(base, OWNER, { address: EDITOR, role: "editor", allow: ["cancel"], deny: ["edit"] });
    expect(can(g, EDITOR, "cancel")).toBe(true);
    expect(can(g, EDITOR, "edit")).toBe(false);
    expect(can(g, "GUNKNOWN", "view")).toBe(false);
  });

  it("revokes access after expiry", () => {
    const g = upsertGrant(base, OWNER, { address: "GV", role: "viewer", expiresAt: 1000 }, 0);
    expect(can(g, "GV", "view", 999)).toBe(true);
    expect(can(g, "GV", "view", 1000)).toBe(false);
  });

  it("enforces who can manage access", () => {
    expect(() => upsertGrant(base, EDITOR, { address: "GX", role: "viewer" })).toThrow();
    expect(() => revokeGrant(base, OWNER, OWNER)).toThrow();
    const admin = upsertGrant(base, OWNER, { address: "GA", role: "editor", allow: ["manageAccess"] });
    expect(() => upsertGrant(admin, "GA", { address: "GX", role: "owner" })).toThrow(/higher/);
    expect(revokeGrant(base, OWNER, EDITOR)).toHaveLength(1);
  });
});
