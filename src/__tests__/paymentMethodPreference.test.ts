import {
  getPreferenceKey,
  loadPreference,
  savePreference,
} from "@/components/PaymentMethodSelector";

describe("PaymentMethodSelector — per-recipient preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("first-time payment to a new recipient returns no preference", () => {
    expect(loadPreference("GPAYER1", "GRECIPIENT1")).toBeNull();
  });

  test("saves and loads a preference for a payer-recipient pair", () => {
    savePreference("GPAYER1", "GRECIPIENT1", "walletconnect");
    expect(loadPreference("GPAYER1", "GRECIPIENT1")).toBe("walletconnect");
  });

  test("updating preference overwrites the previous one", () => {
    savePreference("GPAYER1", "GRECIPIENT1", "walletconnect");
    expect(loadPreference("GPAYER1", "GRECIPIENT1")).toBe("walletconnect");

    savePreference("GPAYER1", "GRECIPIENT1", "freighter");
    expect(loadPreference("GPAYER1", "GRECIPIENT1")).toBe("freighter");
  });

  test("preferences are scoped per payer address", () => {
    savePreference("GPAYER1", "GRECIPIENT1", "walletconnect");
    savePreference("GPAYER2", "GRECIPIENT1", "freighter");

    expect(loadPreference("GPAYER1", "GRECIPIENT1")).toBe("walletconnect");
    expect(loadPreference("GPAYER2", "GRECIPIENT1")).toBe("freighter");
  });

  test("preferences are scoped per recipient address", () => {
    savePreference("GPAYER1", "GRECIPIENT1", "walletconnect");
    savePreference("GPAYER1", "GRECIPIENT2", "freighter");

    expect(loadPreference("GPAYER1", "GRECIPIENT1")).toBe("walletconnect");
    expect(loadPreference("GPAYER1", "GRECIPIENT2")).toBe("freighter");
  });

  test("storage key format includes payer and recipient", () => {
    const key = getPreferenceKey("GPAYER1", "GRECIPIENT1");
    expect(key).toContain("GPAYER1");
    expect(key).toContain("GRECIPIENT1");
  });

  test("returns null for invalid stored values", () => {
    localStorage.setItem(getPreferenceKey("GPAYER1", "GRECIPIENT1"), "invalid");
    expect(loadPreference("GPAYER1", "GRECIPIENT1")).toBeNull();
  });
});
