"use client";

import React, { useState } from "react";
import type { ContractEventView, DecodedField } from "@/lib/contractEvents";

function CodeBlock({
  field,
  label,
}: {
  field: DecodedField;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = field.display || field.raw || "—";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
        {!field.decoded && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/40 cursor-help"
            title={field.error ?? "XDR could not be decoded; showing hex fallback"}
          >
            hex fallback
          </span>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="ml-auto text-[10px] text-gray-500 hover:text-indigo-300"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre
        className="text-xs leading-relaxed overflow-x-auto rounded-lg bg-black/40 border border-gray-800 p-2.5 font-mono text-emerald-200/90 whitespace-pre-wrap break-all"
        title={!field.decoded ? field.error : undefined}
      >
        {text}
      </pre>
    </div>
  );
}

const TYPE_COLOR: Record<string, string> = {
  contract: "bg-indigo-900/50 text-indigo-200 border-indigo-700/50",
  system: "bg-sky-900/50 text-sky-200 border-sky-700/50",
  diagnostic: "bg-fuchsia-900/50 text-fuchsia-200 border-fuchsia-700/50",
};

export default function ContractEventRow({ event }: { event: ContractEventView }) {
  const [open, setOpen] = useState(false);
  const typeClass =
    TYPE_COLOR[event.type] ?? "bg-gray-800 text-gray-300 border-gray-700";

  const topicPreview = event.topics
    .slice(0, 2)
    .map((t) => t.display)
    .join(" · ");

  return (
    <article className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-gray-800/40 transition-colors"
        aria-expanded={open}
      >
        <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${typeClass}`}>
          {event.type}
        </span>
        <span className="text-sm font-mono text-gray-200">ledger {event.ledger}</span>
        {event.ledgerClosedAt && (
          <span className="text-xs text-gray-500">{event.ledgerClosedAt}</span>
        )}
        <span className="text-xs text-gray-500 truncate max-w-[40%] hidden sm:inline">
          {topicPreview || "(no topics)"}
        </span>
        <span className="ml-auto text-xs text-gray-500">{open ? "Hide" : "Details"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
          {event.contractId && (
            <p className="text-xs text-gray-400 font-mono break-all">
              contract: {event.contractId}
            </p>
          )}
          {event.txHash && (
            <p className="text-xs text-gray-400 font-mono break-all">tx: {event.txHash}</p>
          )}
          <div className="grid gap-3">
            {event.topics.map((t, i) => (
              <CodeBlock key={i} field={t} label={`topic[${i}]`} />
            ))}
            <CodeBlock field={event.value} label="value" />
          </div>
          {event.id && (
            <p className="text-[10px] text-gray-600 font-mono break-all">id: {event.id}</p>
          )}
        </div>
      )}
    </article>
  );
}
