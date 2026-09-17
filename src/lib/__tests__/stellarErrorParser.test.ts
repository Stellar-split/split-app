import { describe, it, expect } from "vitest";
import {
  parseStellarOperationError,
  mapStellarErrorCode,
  getStellarErrorMessage,
  STELLAR_OPERATION_ERRORS,
  parseStellarError,
} from "../stellarErrorParser";

describe("stellarErrorParser", () => {
  describe("parseStellarOperationError", () => {
    it("maps known operation error codes to clear English explanations", () => {
      const sampleCodes = [
        "op_no_trust",
        "op_underfunded",
        "op_no_destination",
        "op_not_authorized",
        "op_line_full",
        "op_no_issuer",
        "op_low_reserve",
        "op_bad_auth",
        "op_src_no_trust",
        "op_src_not_authorized",
        "op_cross_self",
        "op_sell_no_trust",
        "op_buy_no_trust",
        "op_sell_not_authorized",
        "op_buy_not_authorized",
        "op_too_few_offers",
      ];

      expect(Object.keys(STELLAR_OPERATION_ERRORS).length).toBeGreaterThanOrEqual(15);

      for (const code of sampleCodes) {
        const result = parseStellarOperationError(code);
        expect(result.code).toBe(code);
        expect(result.message).toBeTruthy();
        expect(result.message).not.toContain("Transaction failed:");
      }
    });

    it("handles case-insensitivity and whitespace", () => {
      const result = parseStellarOperationError("  OP_NO_TRUST  ");
      expect(result.message).toBe("The recipient does not have a trustline for this asset.");
    });

    it("falls back to generic message for unknown codes", () => {
      const result = parseStellarOperationError("custom_unexpected_error");
      expect(result.code).toBe("custom_unexpected_error");
      expect(result.message).toBe("Transaction failed: custom_unexpected_error");
    });

    it("handles empty or null code gracefully", () => {
      const result = parseStellarOperationError("");
      expect(result.message).toBe("Transaction failed: unknown");
    });

    it("provides aliases mapStellarErrorCode and getStellarErrorMessage", () => {
      expect(mapStellarErrorCode("op_underfunded").message).toBe(
        "The source account does not have enough balance to complete the payment."
      );
      expect(getStellarErrorMessage("op_underfunded").message).toBe(
        "The source account does not have enough balance to complete the payment."
      );
    });
  });

  describe("parseStellarError (existing functionality)", () => {
    it("returns ParsedStellarError with code, title, and actionType", () => {
      const res = parseStellarError("tx_insufficient_fee");
      expect(res.code).toBe("tx_insufficient_fee");
      expect(res.actionType).toBe("bump-fee");
      expect(res.message).toBeDefined();
    });

    it("handles unknown error codes with fallback", () => {
      const res = parseStellarError("unknown_code_xyz");
      expect(res.code).toBe("unknown_error");
      expect(res.actionType).toBe("manual");
    });
  });
});
