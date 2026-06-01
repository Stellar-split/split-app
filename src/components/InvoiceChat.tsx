"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { truncateAddress } from "@stellar-split/sdk";

type Recipient = { address: string };

interface InvoiceChatMessage {
  invoiceId: string;
  sender: string;
  text: string;
  timestamp: number;
}

interface Props {
  invoiceId: string;
  creator: string;
  recipients: Recipient[];
  currentAddress: string | null;
}

const STORAGE_PREFIX = "invoice-chat-";

function getStorageKey(invoiceId: string) {
  return `${STORAGE_PREFIX}${invoiceId}`;
}

function parseMessages(value: string | null): InvoiceChatMessage[] {
  try {
    const parsed = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is InvoiceChatMessage =>
          typeof item === "object" &&
          item !== null &&
          typeof item.invoiceId === "string" &&
          typeof item.sender === "string" &&
          typeof item.text === "string" &&
          typeof item.timestamp === "number"
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

function loadMessages(invoiceId: string): InvoiceChatMessage[] {
  if (typeof window === "undefined") return [];
  return parseMessages(localStorage.getItem(getStorageKey(invoiceId)));
}

function saveMessage(invoiceId: string, message: InvoiceChatMessage) {
  const messages = loadMessages(invoiceId);
  localStorage.setItem(
    getStorageKey(invoiceId),
    JSON.stringify([...messages, message])
  );
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export default function InvoiceChat({
  invoiceId,
  creator,
  recipients,
  currentAddress,
}: Props) {
  const [messages, setMessages] = useState<InvoiceChatMessage[]>([]);
  const [text, setText] = useState("");
  const [isAllowed, setIsAllowed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setMessages(loadMessages(invoiceId));
  }, [invoiceId]);

  useEffect(() => {
    setIsAllowed(
      Boolean(
        currentAddress &&
          (currentAddress === creator ||
            recipients.some((recipient) => recipient.address === currentAddress))
      )
    );
  }, [currentAddress, creator, recipients]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === getStorageKey(invoiceId)) {
        setMessages(loadMessages(invoiceId));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [invoiceId]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentAddress || !isAllowed) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    const message: InvoiceChatMessage = {
      invoiceId,
      sender: currentAddress,
      text: trimmed,
      timestamp: Date.now(),
    };

    saveMessage(invoiceId, message);
    setMessages((prev) => [...prev, message]);
    setText("");
    inputRef.current?.focus();
  };

  const placeholder = currentAddress
    ? isAllowed
      ? "Write a message to the invoice participants…"
      : "Only invoice creator and recipients can post messages."
    : "Connect your wallet to join the chat.";

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Invoice Chat</h2>
      <div className="space-y-4">
        {sortedMessages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900 px-4 py-6 text-center text-sm text-gray-400">
            No messages yet. Start the conversation with the invoice creator or recipients.
          </div>
        ) : (
          <ul className="space-y-3">
            {sortedMessages.map((message, index) => (
              <li
                key={`${message.timestamp}-${index}`}
                className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs text-gray-300">
                    {truncateAddress(message.sender)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(message.timestamp)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-gray-200">{message.text}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholder}
            rows={3}
            disabled={!isAllowed}
            className="w-full min-h-[88px] resize-none rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-400">
              {currentAddress ? (
                isAllowed ? (
                  <>Posting as {truncateAddress(currentAddress)}</>
                ) : (
                  <>Your connected wallet is not listed on this invoice.</>
                )
              ) : (
                "Connect a wallet to post messages."
              )}
            </p>
            <button
              type="submit"
              disabled={!isAllowed || !text.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Message
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
