import {
  redactValue,
  redactObject,
  generateExport,
  EXPECTED_TOP_LEVEL_KEYS,
} from "@/lib/accountDataExport";

jest.mock("@/lib/stateSync", () => ({
  STELLARSPLIT_PREFIX: "stellarsplit_",
  collectState: () => ({
    stellarsplit_address_book: "[]",
    stellarsplit_api_key: "sk-live-abcdefghij1234567890",
  }),
}));

beforeEach(() => {
  localStorage.clear();
});

describe("redactValue", () => {
  test("redacts keys matching sensitive patterns", () => {
    expect(redactValue("api_key", "sk-live-abcdef")).toBe("****cdef");
    expect(redactValue("secret", "mysecretvalue123")).toBe("****e123");
    expect(redactValue("password", "hunter2")).toBe("****ter2");
    expect(redactValue("token", "eyJhbGciOiJIUzI")).toBe("****IUzI");
  });

  test("does not redact non-sensitive keys", () => {
    expect(redactValue("address", "GABCDEF")).toBe("GABCDEF");
    expect(redactValue("name", "Alice")).toBe("Alice");
    expect(redactValue("stellarsplit_address_book", "[]")).toBe("[]");
  });

  test("fully redacts short sensitive values", () => {
    expect(redactValue("api_key", "ab")).toBe("****");
    expect(redactValue("token", "xyz")).toBe("****");
  });
});

describe("redactObject", () => {
  test("redacts sensitive keys and preserves others", () => {
    const input = {
      stellarsplit_address_book: "[{name: 'Bob'}]",
      stellarsplit_api_key: "sk-live-1234567890",
      stellarsplit_theme: "dark",
    };
    const result = redactObject(input);
    expect(result.stellarsplit_address_book).toBe("[{name: 'Bob'}]");
    expect(result.stellarsplit_api_key).toBe("****7890");
    expect(result.stellarsplit_theme).toBe("dark");
  });
});

describe("generateExport", () => {
  test("returns all expected top-level keys", async () => {
    const data = await generateExport("GABCDEFTEST");
    for (const key of EXPECTED_TOP_LEVEL_KEYS) {
      expect(data).toHaveProperty(key);
    }
  });

  test("includes wallet address", async () => {
    const data = await generateExport("GABCDEFTEST");
    expect(data.walletAddress).toBe("GABCDEFTEST");
  });

  test("includes exportedAt as ISO string", async () => {
    const data = await generateExport("GABCDEFTEST");
    expect(() => new Date(data.exportedAt)).not.toThrow();
    expect(data.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("does not include private keys in output", async () => {
    localStorage.setItem("stellarsplit_api_key", "sk-secret-key-12345");
    const data = await generateExport("GABCDEFTEST");
    const json = JSON.stringify(data);
    expect(json).not.toContain("sk-secret-key-12345");
  });

  test("calls progress callback", async () => {
    const progress = jest.fn();
    await generateExport("GABCDEFTEST", progress);
    expect(progress).toHaveBeenCalled();
  });

  test("returns address book from localStorage", async () => {
    const book = [{ nickname: "Alice", address: "GALICE" }];
    localStorage.setItem("stellarsplit_address_book", JSON.stringify(book));
    const data = await generateExport("GABCDEFTEST");
    expect(data.addressBook).toEqual(book);
  });
});

describe("EXPECTED_TOP_LEVEL_KEYS", () => {
  test("contains required keys for GDPR export", () => {
    expect(EXPECTED_TOP_LEVEL_KEYS).toContain("exportedAt");
    expect(EXPECTED_TOP_LEVEL_KEYS).toContain("walletAddress");
    expect(EXPECTED_TOP_LEVEL_KEYS).toContain("addressBook");
    expect(EXPECTED_TOP_LEVEL_KEYS).toContain("notificationSettings");
    expect(EXPECTED_TOP_LEVEL_KEYS).toContain("invoiceHistory");
  });
});
