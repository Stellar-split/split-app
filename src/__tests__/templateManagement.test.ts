/**
 * Unit tests for template management and load-into-form logic.
 */

import { encodeTemplate, decodeTemplate } from "@/lib/templateSharing";

interface Recipient {
  address: string;
  amount: string;
}

interface UserTemplate {
  name: string;
  recipients: Recipient[];
  token: string;
  createdAt?: string;
  lastUsed?: string;
}

describe("Template Management Logic", () => {
  const sampleTemplate: UserTemplate = {
    name: "Engineering Stipends",
    recipients: [
      { address: "GBZXN7PIRZGNMHGA728J352Q367AZ2Q2V55HQ2BEXD7J7", amount: "150.5" },
      { address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7", amount: "250.0" },
    ],
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    createdAt: "2026-09-24T12:00:00.000Z",
  };

  test("calculates total amount correctly across recipients", () => {
    const total = sampleTemplate.recipients.reduce(
      (acc, r) => acc + (parseFloat(r.amount) || 0),
      0
    );
    expect(total).toBe(400.5);
  });

  test("validates duplicate template names case-insensitively", () => {
    const existingTemplates: UserTemplate[] = [sampleTemplate];

    const isDuplicate = (name: string, editingIndex: number | null = null) => {
      const trimmed = name.trim().toLowerCase();
      return existingTemplates.some(
        (t, i) => i !== editingIndex && t.name.toLowerCase() === trimmed
      );
    };

    expect(isDuplicate("engineering stipends")).toBe(true);
    expect(isDuplicate("ENGINEERING STIPENDS")).toBe(true);
    expect(isDuplicate("Design Stipends")).toBe(false);
    expect(isDuplicate("Engineering Stipends", 0)).toBe(false); // same item editing
  });

  test("deletes a template from the list by index", () => {
    const templates: UserTemplate[] = [
      sampleTemplate,
      {
        name: "Design Bounty",
        recipients: [{ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7", amount: "50" }],
        token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      },
    ];

    const updated = templates.filter((_, i) => i !== 0);
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe("Design Bounty");
  });

  test("pre-fills invoice creation form state from template", () => {
    const initialFormState = {
      recipients: [{ address: "", amount: "" }],
      token: "",
      deadlineDays: 14,
    };

    const handleLoadTemplate = (template: UserTemplate) => ({
      ...initialFormState,
      recipients: template.recipients.map((r) => ({ ...r })),
      token: template.token,
    });

    const populated = handleLoadTemplate(sampleTemplate);
    expect(populated.recipients).toEqual(sampleTemplate.recipients);
    expect(populated.token).toBe(sampleTemplate.token);
    expect(populated.deadlineDays).toBe(14);
  });

  test("encodes and decodes template for query param URL prefill", () => {
    const shareable = {
      recipients: sampleTemplate.recipients,
      token: sampleTemplate.token,
    };

    const encoded = encodeTemplate(shareable);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = decodeTemplate(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.recipients).toEqual(sampleTemplate.recipients);
    expect(decoded?.token).toBe(sampleTemplate.token);
  });
});
