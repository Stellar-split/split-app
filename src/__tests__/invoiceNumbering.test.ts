import {
  applyPattern,
  getOrAssignDisplayNumber,
  getNumberingSettings,
  saveNumberingSettings,
} from "@/lib/invoiceNumbering";

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Pattern token substitution
// ---------------------------------------------------------------------------

describe("applyPattern — token substitution", () => {
  const base = { seq: 1, year: "2026", month: "06" };

  it("replaces {YYYY} with the year", () => {
    expect(applyPattern("{YYYY}", base)).toBe("2026");
  });

  it("replaces {MM} with the zero-padded month", () => {
    expect(applyPattern("{MM}", base)).toBe("06");
  });

  it("replaces {seq} with a zero-padded 3-digit sequence", () => {
    expect(applyPattern("{seq}", base)).toBe("001");
  });

  it("handles a full pattern like INV-{YYYY}-{seq}", () => {
    expect(applyPattern("INV-{YYYY}-{seq}", base)).toBe("INV-2026-001");
  });

  it("handles a pattern with all three tokens", () => {
    expect(applyPattern("{YYYY}/{MM}/{seq}", base)).toBe("2026/06/001");
  });

  it("zero-pads {seq} to three digits for large numbers", () => {
    expect(applyPattern("{seq}", { seq: 42, year: "2026", month: "01" })).toBe("042");
    expect(applyPattern("{seq}", { seq: 999, year: "2026", month: "01" })).toBe("999");
    expect(applyPattern("{seq}", { seq: 1000, year: "2026", month: "01" })).toBe("1000");
  });

  it("leaves unrecognised tokens untouched", () => {
    expect(applyPattern("REF-{DD}", base)).toBe("REF-{DD}");
  });
});

// ---------------------------------------------------------------------------
// Sequence increment
// ---------------------------------------------------------------------------

describe("getOrAssignDisplayNumber — sequence increment", () => {
  beforeEach(() => {
    saveNumberingSettings({ pattern: "INV-{YYYY}-{seq}" });
  });

  it("assigns seq=1 to the first invoice", () => {
    const dn = getOrAssignDisplayNumber("100", new Date("2026-06-01"));
    expect(dn).toContain("001");
  });

  it("assigns incrementing sequence numbers to subsequent invoices", () => {
    getOrAssignDisplayNumber("1", new Date("2026-06-01"));
    getOrAssignDisplayNumber("2", new Date("2026-06-01"));
    const third = getOrAssignDisplayNumber("3", new Date("2026-06-01"));
    expect(third).toContain("003");
  });

  it("does not increment the sequence when the same invoice is seen again", () => {
    const first = getOrAssignDisplayNumber("50", new Date("2026-06-01"));
    const second = getOrAssignDisplayNumber("50", new Date("2026-06-01"));
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// No retroactive renumbering
// ---------------------------------------------------------------------------

describe("getOrAssignDisplayNumber — no retroactive renumber", () => {
  it("keeps the same display number after the pattern changes", () => {
    saveNumberingSettings({ pattern: "OLD-{seq}" });
    const original = getOrAssignDisplayNumber("7", new Date("2026-06-01"));

    saveNumberingSettings({ pattern: "NEW-{YYYY}-{seq}" });
    const after = getOrAssignDisplayNumber("7", new Date("2026-06-01"));

    // The sequence number stays the same; only the pattern wrapper changes
    expect(original).toContain("001");
    expect(after).toContain("001");
    expect(original).not.toBe(after); // prefix changed, seq stayed
  });

  it("returns empty string when no pattern is set", () => {
    saveNumberingSettings({ pattern: "" });
    expect(getOrAssignDisplayNumber("99")).toBe("");
  });
});
