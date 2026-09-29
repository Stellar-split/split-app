import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AccessibilityAuditPanel from "@/components/AccessibilityAuditPanel";
import { auditColorPairs, auditDocument } from "@/lib/accessibilityAudit";

function html(markup: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = markup;
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("auditDocument", () => {
  it("reports nothing for accessible markup", () => {
    const root = html(`
      <h1>Title</h1><h2>Section</h2>
      <img src="a.png" alt="" />
      <button>Save</button>
      <button aria-label="Close"></button>
      <a href="/x"><img src="i.png" alt="Home" /></a>
      <label for="n">Name</label><input id="n" />
      <label>Email <input /></label>
      <input type="hidden" />
    `);
    expect(auditDocument(root)).toEqual([]);
  });

  it("flags missing alt, unnamed controls, unlabeled fields and heading jumps", () => {
    const root = html(`
      <h1>Title</h1><h3>Skipped</h3>
      <img src="a.png" />
      <button></button>
      <a href="/x"></a>
      <input id="orphan" />
      <select></select>
    `);
    const rules = auditDocument(root).map((i) => i.rule);
    expect(rules.filter((r) => r === "img-alt")).toHaveLength(1);
    expect(rules.filter((r) => r === "control-name")).toHaveLength(2);
    expect(rules.filter((r) => r === "form-label")).toHaveLength(2);
    expect(rules.filter((r) => r === "heading-order")).toHaveLength(1);
  });

  it("accepts aria-labelledby references", () => {
    const root = html(`<span id="l">Amount</span><input aria-labelledby="l" />`);
    expect(auditDocument(root)).toEqual([]);
  });
});

describe("auditColorPairs", () => {
  it("flags low contrast, honours large text and rejects invalid colors", () => {
    const issues = auditColorPairs([
      { label: "ok", foreground: "#000000", background: "#ffffff" },
      { label: "low", foreground: "#aaaaaa", background: "#ffffff" },
      { label: "large-ok", foreground: "#767676", background: "#ffffff", largeText: true },
      { label: "bad", foreground: "nope", background: "#ffffff" },
    ]);
    expect(issues.map((i) => i.element)).toEqual(["low", "bad"]);
    expect(issues[0].message).toContain("below the required 4.5:1");
  });
});

describe("AccessibilityAuditPanel", () => {
  it("runs the audit on demand", () => {
    render(
      <div>
        <img src="x.png" />
        <AccessibilityAuditPanel />
      </div>,
    );
    expect(screen.queryByText(/issue/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Run audit"));
    expect(screen.getByText("1 issue found")).toBeInTheDocument();
    expect(screen.getByText("Image is missing an alt attribute.")).toBeInTheDocument();
  });
});
