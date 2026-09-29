import { render, screen, fireEvent } from "@testing-library/react";
import BrandCustomizationTools from "@/components/settings/BrandCustomizationTools";
import { meetsWcagAaAgainstWhite } from "@/lib/contrast";
import {
  BRAND_PRESETS,
  normalizeHex,
  readableTextColor,
  suggestAccessibleAccent,
} from "@/lib/brandTools";

describe("BRAND_PRESETS", () => {
  it("only offers colors that pass WCAG AA against white", () => {
    for (const p of BRAND_PRESETS) {
      expect(meetsWcagAaAgainstWhite(p.accentColor)).toBe(true);
    }
  });
});

describe("normalizeHex", () => {
  it("expands short hex, lowercases and adds the hash", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("4F46E5")).toBe("#4f46e5");
  });

  it("returns null for invalid colors", () => {
    expect(normalizeHex("nope")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
  });
});

describe("suggestAccessibleAccent", () => {
  it("leaves an already accessible color unchanged", () => {
    expect(suggestAccessibleAccent("#4F46E5")).toBe("#4f46e5");
  });

  it("darkens an inaccessible color until it passes", () => {
    const suggestion = suggestAccessibleAccent("#facc15");
    expect(suggestion).not.toBe("#facc15");
    expect(meetsWcagAaAgainstWhite(suggestion!)).toBe(true);
    expect(meetsWcagAaAgainstWhite("#ffffff")).toBe(false);
    expect(meetsWcagAaAgainstWhite(suggestAccessibleAccent("#ffffff")!)).toBe(true);
  });

  it("returns null for invalid input", () => {
    expect(suggestAccessibleAccent("zzz")).toBeNull();
  });
});

describe("readableTextColor", () => {
  it("picks the more legible of black and white", () => {
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#facc15")).toBe("#000000");
  });
});

describe("BrandCustomizationTools", () => {
  it("applies a preset and reports the brand", () => {
    const onApply = vi.fn();
    render(<BrandCustomizationTools onApply={onApply} />);
    fireEvent.click(screen.getByLabelText("Use Emerald preset"));
    fireEvent.change(screen.getByLabelText("Tagline"), { target: { value: "  Pay with ease  " } });
    fireEvent.click(screen.getByText("Apply branding"));
    expect(onApply).toHaveBeenCalledWith({ accentColor: "#047857", tagline: "Pay with ease" });
  });

  it("blocks inaccessible colors until they are fixed", () => {
    const onApply = vi.fn();
    render(<BrandCustomizationTools accentColor="#facc15" onApply={onApply} />);
    expect(screen.getByRole("status")).toHaveTextContent("fails WCAG AA");
    expect(screen.getByText("Apply branding")).toBeDisabled();

    fireEvent.click(screen.getByText("Make accessible"));
    expect(screen.getByRole("status")).toHaveTextContent("passes WCAG AA");
    expect(screen.getByText("Apply branding")).toBeEnabled();
  });

  it("flags invalid hex input and disables applying", () => {
    render(<BrandCustomizationTools />);
    fireEvent.change(screen.getByLabelText("Accent color"), { target: { value: "not-a-color" } });
    expect(screen.getByRole("status")).toHaveTextContent("Enter a valid hex color");
    expect(screen.getByText("Apply branding")).toBeDisabled();
  });

  it("previews the tagline", () => {
    render(<BrandCustomizationTools tagline="Hello there" />);
    expect(screen.getByTestId("brand-preview")).toHaveTextContent("Hello there");
  });
});
