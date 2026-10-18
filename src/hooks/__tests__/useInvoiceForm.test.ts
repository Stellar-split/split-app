import { describe, it, expect, act } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInvoiceForm } from "../useInvoiceForm";

describe("useInvoiceForm", () => {
  it("starts with an empty expiry date and a resolved timezone", () => {
    const { result } = renderHook(() => useInvoiceForm());
    expect(result.current.expiryDate).toBe("");
    expect(typeof result.current.timezone).toBe("string");
    expect(result.current.timezone.length).toBeGreaterThan(0);
  });

  it("is valid when no expiry date has been set", () => {
    const { result } = renderHook(() => useInvoiceForm());
    expect(result.current.validation.isValid).toBe(true);
    expect(result.current.validation.errors).toEqual({});
  });

  it("accepts a future expiry date as valid", () => {
    const { result } = renderHook(() => useInvoiceForm());
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

    act(() => {
      result.current.setExpiryDate(future);
    });

    expect(result.current.validation.isValid).toBe(true);
    expect(result.current.validation.errors.expiryDate).toBeUndefined();
  });

  it("rejects a past expiry date as invalid", () => {
    const { result } = renderHook(() => useInvoiceForm());
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();

    act(() => {
      result.current.setExpiryDate(past);
    });

    expect(result.current.validation.isValid).toBe(false);
    expect(result.current.validation.errors.expiryDate).toBe("Expiry date cannot be in the past");
  });

  it("updates the timezone when setTimezone is called", () => {
    const { result } = renderHook(() => useInvoiceForm());

    act(() => {
      result.current.setTimezone("America/New_York");
    });

    expect(result.current.timezone).toBe("America/New_York");
  });

  it("getUtcTimestamp returns null when no expiry date is set", () => {
    const { result } = renderHook(() => useInvoiceForm());
    expect(result.current.getUtcTimestamp()).toBeNull();
  });

  it("getUtcTimestamp returns null when the expiry date is invalid", () => {
    const { result } = renderHook(() => useInvoiceForm());
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

    act(() => {
      result.current.setExpiryDate(past);
    });

    expect(result.current.getUtcTimestamp()).toBeNull();
  });

  it("getUtcTimestamp returns a unix timestamp in seconds for a valid future date", () => {
    const { result } = renderHook(() => useInvoiceForm());
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);

    act(() => {
      result.current.setExpiryDate(future.toISOString());
    });

    const expected = Math.floor(future.getTime() / 1000);
    expect(result.current.getUtcTimestamp()).toBe(expected);
  });

  it("convertToUtcIso returns null when no expiry date is set", () => {
    const { result } = renderHook(() => useInvoiceForm());
    expect(result.current.convertToUtcIso()).toBeNull();
  });

  it("convertToUtcIso returns an ISO string for a set expiry date, even in the past", () => {
    const { result } = renderHook(() => useInvoiceForm());
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);

    act(() => {
      result.current.setExpiryDate(past.toISOString());
    });

    expect(result.current.convertToUtcIso()).toBe(past.toISOString());
  });
});
