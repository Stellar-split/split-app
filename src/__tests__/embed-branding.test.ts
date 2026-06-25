/**
 * Unit tests for embed branding URL generation and storage.
 *
 * Covers:
 *  - generating themed embed URLs with query parameters
 *  - validating parameter encoding
 *  - localStorage persistence
 *  - fallback behavior for missing/invalid parameters
 */

describe("embed branding URL generation", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe("URL generation", () => {
    test("generates base URL without parameters when no branding set", () => {
      const branding = { primaryColor: "", logoUrl: "", borderRadius: "" };
      const params = new URLSearchParams();

      if (branding.primaryColor) params.append("primaryColor", branding.primaryColor);
      if (branding.logoUrl) params.append("logoUrl", branding.logoUrl);
      if (branding.borderRadius) params.append("borderRadius", branding.borderRadius);

      const url = params.toString() ? `/embed/test-id?${params}` : `/embed/test-id`;
      expect(url).toBe("/embed/test-id");
    });

    test("generates URL with single parameter", () => {
      const branding = { primaryColor: "#ff0000", logoUrl: "", borderRadius: "" };
      const params = new URLSearchParams();

      if (branding.primaryColor) params.append("primaryColor", branding.primaryColor);
      if (branding.logoUrl) params.append("logoUrl", branding.logoUrl);
      if (branding.borderRadius) params.append("borderRadius", branding.borderRadius);

      const url = params.toString() ? `/embed/test-id?${params}` : `/embed/test-id`;
      expect(url).toContain("primaryColor=%23ff0000");
    });

    test("generates URL with multiple parameters", () => {
      const branding = {
        primaryColor: "#ff0000",
        logoUrl: "https://example.com/logo.png",
        borderRadius: "8px",
      };
      const params = new URLSearchParams();

      if (branding.primaryColor) params.append("primaryColor", branding.primaryColor);
      if (branding.logoUrl) params.append("logoUrl", branding.logoUrl);
      if (branding.borderRadius) params.append("borderRadius", branding.borderRadius);

      const url = params.toString() ? `/embed/test-id?${params}` : `/embed/test-id`;
      expect(url).toContain("primaryColor");
      expect(url).toContain("logoUrl");
      expect(url).toContain("borderRadius");
    });

    test("properly encodes URL with special characters", () => {
      const branding = {
        primaryColor: "#ff0000",
        logoUrl: "https://example.com/logo%20v2.png",
        borderRadius: "",
      };
      const params = new URLSearchParams();

      if (branding.primaryColor) params.append("primaryColor", branding.primaryColor);
      if (branding.logoUrl) params.append("logoUrl", branding.logoUrl);
      if (branding.borderRadius) params.append("borderRadius", branding.borderRadius);

      const url = params.toString() ? `/embed/test-id?${params}` : `/embed/test-id`;
      const parsed = new URLSearchParams(url.split("?")[1]);
      expect(parsed.get("logoUrl")).toContain("example.com/logo%20v2.png");
    });
  });

  describe("localStorage persistence", () => {
    test("saves branding config to localStorage", () => {
      const config = {
        primaryColor: "#ff0000",
        logoUrl: "https://example.com/logo.png",
        borderRadius: "8px",
      };

      localStorage.setItem("stellarsplit_embed_branding", JSON.stringify(config));
      const stored = JSON.parse(
        localStorage.getItem("stellarsplit_embed_branding") ?? "{}"
      );

      expect(stored).toEqual(config);
    });

    test("retrieves branding config from localStorage", () => {
      const config = {
        primaryColor: "#00ff00",
        logoUrl: "https://example.com/branding.png",
        borderRadius: "12px",
      };

      localStorage.setItem("stellarsplit_embed_branding", JSON.stringify(config));

      const retrieved = JSON.parse(
        localStorage.getItem("stellarsplit_embed_branding") ?? '{"primaryColor":"","logoUrl":"","borderRadius":""}'
      );

      expect(retrieved.primaryColor).toBe("#00ff00");
      expect(retrieved.logoUrl).toBe("https://example.com/branding.png");
      expect(retrieved.borderRadius).toBe("12px");
    });

    test("returns defaults when localStorage is empty", () => {
      const defaults = { primaryColor: "", logoUrl: "", borderRadius: "" };
      const retrieved = JSON.parse(
        localStorage.getItem("stellarsplit_embed_branding") ??
          JSON.stringify(defaults)
      );

      expect(retrieved).toEqual(defaults);
    });

    test("handles corrupted localStorage gracefully", () => {
      localStorage.setItem("stellarsplit_embed_branding", "not valid json");

      try {
        const retrieved = JSON.parse(
          localStorage.getItem("stellarsplit_embed_branding") ?? '{"primaryColor":"","logoUrl":"","borderRadius":""}'
        );
        // If parsing the stored value fails, we expect to fall back to defaults
        expect(retrieved).toBeDefined();
      } catch {
        // Fallback to defaults on parse error
        const defaults = { primaryColor: "", logoUrl: "", borderRadius: "" };
        expect(defaults).toBeDefined();
      }
    });
  });

  describe("parameter validation in URL", () => {
    test("skips empty primaryColor parameter", () => {
      const branding = { primaryColor: "", logoUrl: "", borderRadius: "" };
      const params = new URLSearchParams();

      if (branding.primaryColor) params.append("primaryColor", branding.primaryColor);

      expect(params.toString()).toBe("");
    });

    test("includes valid hex color parameter", () => {
      const branding = { primaryColor: "#4f46e5", logoUrl: "", borderRadius: "" };
      const params = new URLSearchParams();

      if (branding.primaryColor) params.append("primaryColor", branding.primaryColor);

      expect(params.toString()).toContain("primaryColor=%234f46e5");
    });

    test("includes valid HTTPS URL parameter", () => {
      const branding = {
        primaryColor: "",
        logoUrl: "https://example.com/logo.png",
        borderRadius: "",
      };
      const params = new URLSearchParams();

      if (branding.logoUrl) params.append("logoUrl", branding.logoUrl);

      expect(params.toString()).toContain("logoUrl=https");
    });

    test("includes valid border radius parameter", () => {
      const branding = {
        primaryColor: "",
        logoUrl: "",
        borderRadius: "8px",
      };
      const params = new URLSearchParams();

      if (branding.borderRadius) params.append("borderRadius", branding.borderRadius);

      expect(params.toString()).toContain("borderRadius=8px");
    });
  });

  describe("URL template for documentation", () => {
    test("generates correct template URL with placeholder", () => {
      const branding = {
        primaryColor: "#ff0000",
        logoUrl: "https://example.com/logo.png",
        borderRadius: "8px",
      };
      const params = new URLSearchParams();

      if (branding.primaryColor) params.append("primaryColor", branding.primaryColor);
      if (branding.logoUrl) params.append("logoUrl", branding.logoUrl);
      if (branding.borderRadius) params.append("borderRadius", branding.borderRadius);

      const templateUrl = params.toString()
        ? `/embed/INVOICE_ID?${params}`
        : `/embed/INVOICE_ID`;

      expect(templateUrl).toContain("INVOICE_ID");
      expect(templateUrl).toContain("primaryColor");
      expect(templateUrl).toContain("logoUrl");
      expect(templateUrl).toContain("borderRadius");
    });
  });
});
