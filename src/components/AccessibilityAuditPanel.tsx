"use client";

import { useState } from "react";
import { auditDocument, type A11yIssue } from "@/lib/accessibilityAudit";

/** Runs the accessibility audit over the current page and lists what it finds. */
export default function AccessibilityAuditPanel() {
  const [issues, setIssues] = useState<A11yIssue[] | null>(null);

  return (
    <section aria-labelledby="audit-heading" className="border-t border-gray-700 pt-8">
      <h2 id="audit-heading" className="mb-2 text-lg font-semibold">
        Accessibility audit
      </h2>
      <p className="mb-4 text-sm text-gray-400">
        Check this page for missing alt text, unlabeled controls and fields, and skipped heading levels.
      </p>
      <button
        type="button"
        className="rounded border border-gray-600 px-3 py-2 text-sm"
        onClick={() => setIssues(auditDocument(document.body))}
      >
        Run audit
      </button>

      <div role="status" aria-live="polite" className="mt-4">
        {issues !== null && issues.length === 0 && <p className="text-sm text-green-400">No issues found.</p>}
        {issues !== null && issues.length > 0 && (
          <>
            <p className="mb-2 text-sm">
              {issues.length} issue{issues.length === 1 ? "" : "s"} found
            </p>
            <ul className="space-y-2">
              {issues.map((issue, i) => (
                <li key={i} className="rounded border border-gray-700 p-3 text-sm">
                  <p className="font-medium">{issue.message}</p>
                  <code className="break-all text-xs text-gray-400">{issue.element}</code>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
