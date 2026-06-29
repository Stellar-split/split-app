import { findBatchDuplicates } from "@/lib/batchDuplicates";

describe("findBatchDuplicates", () => {
  test("detects exact-duplicate rows (same recipient, amount)", () => {
    const rows = [
      { recipients: [{ address: "GABC", amount: "100" }], deadlineDays: 7 },
      { recipients: [{ address: "GABC", amount: "100" }], deadlineDays: 14 },
    ];
    const dupes = findBatchDuplicates(rows);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].recipient).toBe("gabc");
    expect(dupes[0].amount).toBe("100");
    expect(dupes[0].rowNumbers).toEqual([1, 2]);
  });

  test("does not flag rows with different amounts as duplicates", () => {
    const rows = [
      { recipients: [{ address: "GABC", amount: "100" }], deadlineDays: 7 },
      { recipients: [{ address: "GABC", amount: "200" }], deadlineDays: 7 },
    ];
    const dupes = findBatchDuplicates(rows);
    expect(dupes).toHaveLength(0);
  });

  test("does not flag rows with different recipients as duplicates", () => {
    const rows = [
      { recipients: [{ address: "GABC", amount: "100" }], deadlineDays: 7 },
      { recipients: [{ address: "GXYZ", amount: "100" }], deadlineDays: 7 },
    ];
    const dupes = findBatchDuplicates(rows);
    expect(dupes).toHaveLength(0);
  });

  test("detects duplicates across multiple recipients within rows", () => {
    const rows = [
      {
        recipients: [
          { address: "GABC", amount: "50" },
          { address: "GXYZ", amount: "75" },
        ],
        deadlineDays: 7,
      },
      {
        recipients: [{ address: "GABC", amount: "50" }],
        deadlineDays: 14,
      },
    ];
    const dupes = findBatchDuplicates(rows);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].amount).toBe("50");
    expect(dupes[0].rowNumbers).toEqual([1, 2]);
  });

  test("returns empty for a single row", () => {
    const rows = [
      { recipients: [{ address: "GABC", amount: "100" }], deadlineDays: 7 },
    ];
    expect(findBatchDuplicates(rows)).toHaveLength(0);
  });

  test("ignores rows with empty address or amount", () => {
    const rows = [
      { recipients: [{ address: "", amount: "100" }], deadlineDays: 7 },
      { recipients: [{ address: "", amount: "100" }], deadlineDays: 7 },
    ];
    expect(findBatchDuplicates(rows)).toHaveLength(0);
  });

  test("treats addresses as case-insensitive", () => {
    const rows = [
      { recipients: [{ address: "GABC", amount: "100" }], deadlineDays: 7 },
      { recipients: [{ address: "gabc", amount: "100" }], deadlineDays: 7 },
    ];
    const dupes = findBatchDuplicates(rows);
    expect(dupes).toHaveLength(1);
  });

  test("detects three-way duplicates", () => {
    const rows = [
      { recipients: [{ address: "GABC", amount: "100" }], deadlineDays: 7 },
      { recipients: [{ address: "GABC", amount: "100" }], deadlineDays: 7 },
      { recipients: [{ address: "GABC", amount: "100" }], deadlineDays: 7 },
    ];
    const dupes = findBatchDuplicates(rows);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].rowNumbers).toEqual([1, 2, 3]);
  });
});
