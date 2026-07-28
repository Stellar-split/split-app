import { describe, it, expect } from "vitest";
import { WEBHOOK_SCHEMAS, validateSchemas } from "@/lib/webhookSchemas";

describe("webhookSchemas", () => {
  it("every schema has a non-empty eventType", () => {
    for (const schema of WEBHOOK_SCHEMAS) {
      expect(schema.eventType).toBeTruthy();
      expect(schema.eventType.length).toBeGreaterThan(0);
    }
  });

  it("every schema has at least one field", () => {
    for (const schema of WEBHOOK_SCHEMAS) {
      expect(schema.fields.length).toBeGreaterThan(0);
    }
  });

  it("every schema example is JSON-serializable", () => {
    for (const schema of WEBHOOK_SCHEMAS) {
      expect(() => JSON.stringify(schema.example)).not.toThrow();
    }
  });

  it("validateSchemas returns true", () => {
    expect(validateSchemas()).toBe(true);
  });

  it("every schema example contains all required fields", () => {
    for (const schema of WEBHOOK_SCHEMAS) {
      const requiredFields = schema.fields.filter((f) => f.required);
      for (const field of requiredFields) {
        expect(schema.example).toHaveProperty(field.name);
      }
    }
  });
});
