import { setBulkReminders, getReminders } from "@/lib/reminders";

const FUTURE_DATE = "2030-01-01T10:00:00.000Z";

beforeEach(() => {
  localStorage.clear();
});

describe("setBulkReminders — partial failure reporting", () => {
  it("reports success for each invoice when all succeed", () => {
    const results = setBulkReminders(["1", "2", "3"], FUTURE_DATE);
    expect(results).toHaveLength(3);
    results.forEach((r) => expect(r.success).toBe(true));
    results.forEach((r) => expect(r.error).toBeUndefined());
  });

  it("returns the correct invoiceId in each result", () => {
    const results = setBulkReminders(["10", "20"], FUTURE_DATE);
    expect(results[0].invoiceId).toBe("10");
    expect(results[1].invoiceId).toBe("20");
  });

  it("reports failure individually when localStorage throws for one invoice", () => {
    const original = Storage.prototype.setItem;
    let callCount = 0;
    Storage.prototype.setItem = jest.fn(function (key, value) {
      callCount++;
      if (callCount === 2) {
        throw new Error("QuotaExceededError");
      }
      return original.call(this, key, value);
    });

    const results = setBulkReminders(["a", "b", "c"], FUTURE_DATE);

    Storage.prototype.setItem = original;

    const failed = results.filter((r) => !r.success);
    const succeeded = results.filter((r) => r.success);
    expect(failed.length).toBeGreaterThanOrEqual(1);
    expect(succeeded.length).toBeGreaterThanOrEqual(1);
    failed.forEach((r) => expect(r.error).toBeDefined());
  });

  it("reports each invoice result separately, not as one opaque error", () => {
    const results = setBulkReminders(["x", "y"], FUTURE_DATE);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty("invoiceId");
    expect(results[0]).toHaveProperty("success");
    expect(results[1]).toHaveProperty("invoiceId");
    expect(results[1]).toHaveProperty("success");
  });
});

describe("setBulkReminders — selection clearing behavior", () => {
  it("persists reminders in localStorage for all selected invoices", () => {
    setBulkReminders(["5", "6"], FUTURE_DATE);
    const stored = getReminders();
    const ids = stored.map((r) => r.invoiceId);
    expect(ids).toContain("5");
    expect(ids).toContain("6");
  });

  it("applies the same reminderDate to all invoices", () => {
    setBulkReminders(["7", "8"], FUTURE_DATE);
    const stored = getReminders();
    const forSeven = stored.find((r) => r.invoiceId === "7");
    const forEight = stored.find((r) => r.invoiceId === "8");
    expect(forSeven?.reminderDate).toBe(FUTURE_DATE);
    expect(forEight?.reminderDate).toBe(FUTURE_DATE);
  });

  it("returns an empty array when given no invoice ids", () => {
    const results = setBulkReminders([], FUTURE_DATE);
    expect(results).toEqual([]);
  });
});
