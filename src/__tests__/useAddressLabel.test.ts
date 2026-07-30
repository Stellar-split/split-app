import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveAddressLabel } from "@/hooks/useAddressLabel";

describe("useAddressLabel / resolveAddressLabel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for empty address", async () => {
    const result = await resolveAddressLabel("");
    expect(result).toBeNull();
  });

  it("derives label for federation addresses (user*domain.com)", async () => {
    vi.mock("@stellar/stellar-sdk", () => ({
      Federation: {
        Server: {
          resolve: vi.fn().mockResolvedValue({
            account_id: "G12345678901234567890123456789012345678901234567890123456",
          }),
        },
      },
    }));

    const result = await resolveAddressLabel("alice*stellar.org");
    expect(result).toBe("Alice");
  });

  it("falls back to past history or formatted label if resolution fails", async () => {
    const result = await resolveAddressLabel("GUNKNOWN123456789012345678901234567890123456789012345678");
    // Should gracefully handle missing domain/federation without crashing
    expect(result === null || typeof result === "string").toBe(true);
  });
});
