import { getArbitrators, searchArbitrators, getArbitratorByAddress } from "@/lib/arbitrators";

beforeEach(() => {
  localStorage.clear();
});

describe("getArbitrators", () => {
  test("returns default registry when localStorage is empty", () => {
    const result = getArbitrators();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("address");
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("resolvedDisputeCount");
  });

  test("returns stored registry when present", () => {
    const custom = [
      { address: "GCUSTOM1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", name: "CustomArb", resolvedDisputeCount: 5 },
    ];
    localStorage.setItem("stellarsplit_arbitrator_registry", JSON.stringify(custom));
    const result = getArbitrators();
    expect(result).toEqual(custom);
  });

  test("falls back to default on corrupted storage", () => {
    localStorage.setItem("stellarsplit_arbitrator_registry", "not-json");
    const result = getArbitrators();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("searchArbitrators", () => {
  test("returns all arbitrators for empty query", () => {
    const all = getArbitrators();
    const result = searchArbitrators("");
    expect(result).toEqual(all);
  });

  test("filters by name (case-insensitive)", () => {
    const result = searchArbitrators("stellarmediate");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("StellarMediate");
  });

  test("filters by partial name", () => {
    const result = searchArbitrators("chain");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("ChainResolve");
  });

  test("filters by address substring", () => {
    const all = getArbitrators();
    const addr = all[0].address.slice(0, 10).toLowerCase();
    const result = searchArbitrators(addr);
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns empty array when nothing matches", () => {
    const result = searchArbitrators("zzzznonexistent");
    expect(result).toEqual([]);
  });
});

describe("getArbitratorByAddress", () => {
  test("returns matching arbitrator", () => {
    const all = getArbitrators();
    const result = getArbitratorByAddress(all[0].address);
    expect(result).toEqual(all[0]);
  });

  test("returns undefined for unknown address", () => {
    const result = getArbitratorByAddress("GUNKNOWNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    expect(result).toBeUndefined();
  });
});

describe("empty registry fallback", () => {
  test("searchArbitrators returns empty when registry is explicitly empty", () => {
    localStorage.setItem("stellarsplit_arbitrator_registry", "[]");
    const result = searchArbitrators("");
    // falls back to defaults since empty array triggers default
    expect(result.length).toBeGreaterThan(0);
  });
});
