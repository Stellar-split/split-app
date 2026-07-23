/**
 * Unit tests for EmbedThemeProvider.
 *
 * Covers:
 *  - hex color validation (valid/invalid formats)
 *  - logo URL validation (HTTPS only, invalid URLs)
 *  - border-radius validation (valid CSS units)
 *  - fallback to defaults for invalid inputs
 *  - CSS variable application on wrapper element
 */

import React from "react";
import { render } from "@testing-library/react";
import EmbedThemeProvider, { validateThemeConfig } from "@/components/EmbedThemeProvider";

describe("validateThemeConfig", () => {
  describe("hex color validation", () => {
    test("accepts valid 6-digit hex colors", () => {
      const config = validateThemeConfig({ primaryColor: "#4f46e5" });
      expect(config.primaryColor).toBe("#4f46e5");
    });

    test("accepts valid 3-digit hex colors", () => {
      const config = validateThemeConfig({ primaryColor: "#f00" });
      expect(config.primaryColor).toBe("#f00");
    });

    test("accepts valid 8-digit hex colors (with alpha)", () => {
      const config = validateThemeConfig({ primaryColor: "#4f46e580" });
      expect(config.primaryColor).toBe("#4f46e580");
    });

    test("accepts valid 4-digit hex colors (with alpha)", () => {
      const config = validateThemeConfig({ primaryColor: "#f00f" });
      expect(config.primaryColor).toBe("#f00f");
    });

    test("rejects invalid hex without #", () => {
      const config = validateThemeConfig({ primaryColor: "4f46e5" });
      expect(config.primaryColor).toBeUndefined();
    });

    test("rejects invalid hex with wrong character count", () => {
      const config = validateThemeConfig({ primaryColor: "#4f46e" });
      expect(config.primaryColor).toBeUndefined();
    });

    test("rejects invalid hex with non-hex characters", () => {
      const config = validateThemeConfig({ primaryColor: "#4f46zz" });
      expect(config.primaryColor).toBeUndefined();
    });

    test("rejects empty color string", () => {
      const config = validateThemeConfig({ primaryColor: "" });
      expect(config.primaryColor).toBeUndefined();
    });
  });

  describe("logo URL validation", () => {
    test("accepts valid HTTPS URLs", () => {
      const config = validateThemeConfig({
        logoUrl: "https://example.com/logo.png",
      });
      expect(config.logoUrl).toBe("https://example.com/logo.png");
    });

    test("rejects HTTP URLs", () => {
      const config = validateThemeConfig({
        logoUrl: "http://example.com/logo.png",
      });
      expect(config.logoUrl).toBeUndefined();
    });

    test("rejects relative URLs", () => {
      const config = validateThemeConfig({
        logoUrl: "/assets/logo.png",
      });
      expect(config.logoUrl).toBeUndefined();
    });

    test("rejects data URLs", () => {
      const config = validateThemeConfig({
        logoUrl: "data:image/png;base64,abc123",
      });
      expect(config.logoUrl).toBeUndefined();
    });

    test("rejects invalid URLs", () => {
      const config = validateThemeConfig({
        logoUrl: "not a url",
      });
      expect(config.logoUrl).toBeUndefined();
    });

    test("rejects empty URL string", () => {
      const config = validateThemeConfig({
        logoUrl: "",
      });
      expect(config.logoUrl).toBeUndefined();
    });
  });

  describe("border-radius validation", () => {
    test("accepts px units", () => {
      const config = validateThemeConfig({ borderRadius: "8px" });
      expect(config.borderRadius).toBe("8px");
    });

    test("accepts rem units", () => {
      const config = validateThemeConfig({ borderRadius: "0.5rem" });
      expect(config.borderRadius).toBe("0.5rem");
    });

    test("accepts em units", () => {
      const config = validateThemeConfig({ borderRadius: "0.5em" });
      expect(config.borderRadius).toBe("0.5em");
    });

    test("accepts percentage units", () => {
      const config = validateThemeConfig({ borderRadius: "50%" });
      expect(config.borderRadius).toBe("50%");
    });

    test("rejects values without units", () => {
      const config = validateThemeConfig({ borderRadius: "8" });
      expect(config.borderRadius).toBeUndefined();
    });

    test("rejects invalid CSS units", () => {
      const config = validateThemeConfig({ borderRadius: "8ch" });
      expect(config.borderRadius).toBeUndefined();
    });

    test("rejects empty string", () => {
      const config = validateThemeConfig({ borderRadius: "" });
      expect(config.borderRadius).toBeUndefined();
    });

    test("allows empty string for optional fields (uses default)", () => {
      const config = validateThemeConfig({ borderRadius: "" });
      expect(config.borderRadius).toBeUndefined();
    });
  });

  describe("config fallback", () => {
    test("returns empty config for all invalid inputs", () => {
      const config = validateThemeConfig({
        primaryColor: "invalid",
        logoUrl: "not-a-url",
        borderRadius: "invalid",
      });
      expect(config).toEqual({});
    });

    test("returns partial config with only valid fields", () => {
      const config = validateThemeConfig({
        primaryColor: "#4f46e5",
        logoUrl: "invalid",
        borderRadius: "8px",
      });
      expect(config).toEqual({
        primaryColor: "#4f46e5",
        borderRadius: "8px",
      });
      expect(config.logoUrl).toBeUndefined();
    });
  });
});

describe("EmbedThemeProvider component", () => {
  test("applies CSS variables to wrapper element", () => {
    const { container } = render(
      <EmbedThemeProvider
        config={{
          primaryColor: "#ff0000",
          logoUrl: "https://example.com/logo.png",
          borderRadius: "8px",
        }}
      >
        <div>Test content</div>
      </EmbedThemeProvider>
    );

    const wrapper = container.firstChild as HTMLElement;
    const styles = getComputedStyle(wrapper);

    expect(wrapper.style.getPropertyValue("--embed-primary-color")).toBe("#ff0000");
    expect(wrapper.style.getPropertyValue("--embed-border-radius")).toBe("8px");
    expect(wrapper.style.getPropertyValue("--embed-logo-url")).toContain(
      "url('https://example.com/logo.png')"
    );
  });

  test("uses default values when config is empty", () => {
    const { container } = render(
      <EmbedThemeProvider config={{}}>
        <div>Test content</div>
      </EmbedThemeProvider>
    );

    const wrapper = container.firstChild as HTMLElement;

    expect(wrapper.style.getPropertyValue("--embed-primary-color")).toBe(
      "#4f46e5"
    );
    expect(wrapper.style.getPropertyValue("--embed-border-radius")).toBe(
      "0.5rem"
    );
    expect(wrapper.style.getPropertyValue("--embed-logo-url")).toBe("none");
  });

  test("falls back to defaults for invalid values", () => {
    const { container } = render(
      <EmbedThemeProvider
        config={{
          primaryColor: "invalid",
          logoUrl: "http://insecure.com/logo.png",
          borderRadius: "invalid",
        }}
      >
        <div>Test content</div>
      </EmbedThemeProvider>
    );

    const wrapper = container.firstChild as HTMLElement;

    expect(wrapper.style.getPropertyValue("--embed-primary-color")).toBe(
      "#4f46e5"
    );
    expect(wrapper.style.getPropertyValue("--embed-border-radius")).toBe(
      "0.5rem"
    );
    expect(wrapper.style.getPropertyValue("--embed-logo-url")).toBe("none");
  });

  test("renders children correctly", () => {
    const { getByText } = render(
      <EmbedThemeProvider config={{}}>
        <div>Test content</div>
      </EmbedThemeProvider>
    );

    expect(getByText("Test content")).toBeInTheDocument();
  });

  test("updates CSS variables when config changes", () => {
    const { container, rerender } = render(
      <EmbedThemeProvider config={{ primaryColor: "#ff0000" }}>
        <div>Test</div>
      </EmbedThemeProvider>
    );

    let wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.getPropertyValue("--embed-primary-color")).toBe(
      "#ff0000"
    );

    rerender(
      <EmbedThemeProvider config={{ primaryColor: "#00ff00" }}>
        <div>Test</div>
      </EmbedThemeProvider>
    );

    wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.getPropertyValue("--embed-primary-color")).toBe(
      "#00ff00"
    );
  });
});
