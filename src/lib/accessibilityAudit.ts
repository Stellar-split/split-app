import { WCAG_AA_CONTRAST_RATIO, WCAG_AA_LARGE_TEXT_CONTRAST_RATIO, contrastRatio, isValidHexColor } from "@/lib/contrast";

export type A11yRule = "img-alt" | "control-name" | "form-label" | "heading-order" | "color-contrast";

export interface A11yIssue {
  rule: A11yRule;
  message: string;
  /** Short description of the offending element, e.g. `<button class="x">`. */
  element: string;
}

export interface ColorPair {
  label: string;
  foreground: string;
  background: string;
  largeText?: boolean;
}

function describe(el: Element): string {
  const cls = el.getAttribute("class");
  return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ""}>`;
}

function hasText(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}

function referencedText(el: Element, attr: "aria-labelledby"): boolean {
  const ids = el.getAttribute(attr)?.split(/\s+/).filter(Boolean) ?? [];
  const doc = el.ownerDocument;
  return ids.some((id) => hasText(doc.getElementById(id)?.textContent));
}

function hasAccessibleName(el: Element): boolean {
  if (hasText(el.getAttribute("aria-label")) || referencedText(el, "aria-labelledby")) return true;
  if (hasText(el.getAttribute("title"))) return true;
  if (hasText(el.textContent)) return true;
  return Array.from(el.querySelectorAll("img")).some((img) => hasText(img.getAttribute("alt")));
}

function hasLabel(el: Element): boolean {
  if (hasText(el.getAttribute("aria-label")) || referencedText(el, "aria-labelledby")) return true;
  if (el.closest("label")) return true;
  const id = el.getAttribute("id");
  if (!id) return false;
  return Array.from(el.ownerDocument.querySelectorAll("label")).some((l) => l.getAttribute("for") === id);
}

/** Audits the DOM under `root` for common, mechanically detectable WCAG problems. */
export function auditDocument(root: ParentNode): A11yIssue[] {
  const issues: A11yIssue[] = [];

  root.querySelectorAll("img").forEach((img) => {
    if (!img.hasAttribute("alt")) {
      issues.push({ rule: "img-alt", message: "Image is missing an alt attribute.", element: describe(img) });
    }
  });

  root.querySelectorAll("button, a[href], [role='button']").forEach((el) => {
    if (!hasAccessibleName(el)) {
      issues.push({ rule: "control-name", message: "Interactive control has no accessible name.", element: describe(el) });
    }
  });

  root.querySelectorAll("input, select, textarea").forEach((el) => {
    const type = el.getAttribute("type");
    if (type === "hidden" || type === "submit" || type === "button" || type === "reset" || type === "image") return;
    if (!hasLabel(el)) {
      issues.push({ rule: "form-label", message: "Form field has no label.", element: describe(el) });
    }
  });

  let previous = 0;
  root.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
    const level = Number(heading.tagName[1]);
    if (previous > 0 && level > previous + 1) {
      issues.push({
        rule: "heading-order",
        message: `Heading level jumps from h${previous} to h${level}.`,
        element: describe(heading),
      });
    }
    previous = level;
  });

  return issues;
}

/** Checks foreground/background pairs against WCAG AA (4.5:1, or 3:1 for large text). */
export function auditColorPairs(pairs: ColorPair[]): A11yIssue[] {
  const issues: A11yIssue[] = [];
  for (const pair of pairs) {
    if (!isValidHexColor(pair.foreground) || !isValidHexColor(pair.background)) {
      issues.push({ rule: "color-contrast", message: `${pair.label}: invalid color value.`, element: pair.label });
      continue;
    }
    const required = pair.largeText ? WCAG_AA_LARGE_TEXT_CONTRAST_RATIO : WCAG_AA_CONTRAST_RATIO;
    const ratio = contrastRatio(pair.foreground, pair.background);
    if (ratio < required) {
      issues.push({
        rule: "color-contrast",
        message: `${pair.label}: contrast ${ratio.toFixed(2)}:1 is below the required ${required}:1.`,
        element: pair.label,
      });
    }
  }
  return issues;
}
