"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import {
  type ApiKey,
  type ApiKeyScope,
  buildApiKey,
  dismissMigrationBanner,
  isMigrationBannerDismissed,
  loadKeys,
  saveKeys,
} from "@/lib/apiKeys"

function maskKey(key: string) {
  if (!key) return ""
  const prefix = key.startsWith("sk_") ? key.match(/^sk_(?:read|write)_/)?.[0] ?? "sk_" : ""
  const rest = key.slice(prefix.length)
  if (rest.length <= 8) return prefix + "****...****"
  const start = rest.slice(0, 2)
  const end = rest.slice(-2)
  return `${prefix}${start}****...****${end}`
}

function ScopeBadge({ scope }: { scope: ApiKeyScope }) {
  const isWrite = scope === "write"
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        isWrite
          ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
          : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
      }`}
    >
      {isWrite ? "Write" : "Read-only"}
    </span>
  )
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [name, setName] = useState("")
  const [scope, setScope] = useState<ApiKeyScope>("read")
  const [showNewKey, setShowNewKey] = useState<string | null>(null)
  const [showMigrationBanner, setShowMigrationBanner] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const { keys: loaded, migratedLegacy } = loadKeys()
    setKeys(loaded)
    if (migratedLegacy && !isMigrationBannerDismissed()) {
      setShowMigrationBanner(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    saveKeys(keys)
  }, [keys])

  async function handleGenerate() {
    if (!name.trim()) {
      alert("Please provide a name for the key")
      return
    }
    setIsGenerating(true)
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.id || !body?.key) {
        throw new Error(body?.error ?? "Failed to generate API key")
      }
      const item = buildApiKey({ id: body.id, name, key: body.key, scope })
      const updated = [item, ...keys]
      setKeys(updated)
      setShowNewKey(item.key)
      setName("")
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to generate API key")
    } finally {
      setIsGenerating(false)
    }
  }

  function handleRevoke(id: string) {
    if (!confirm("Revoke this API key?")) return
    const updated = keys.filter((k) => k.id !== id)
    setKeys(updated)
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard"))
  }

  function handleDismissMigrationBanner() {
    dismissMigrationBanner()
    setShowMigrationBanner(false)
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <Link href="/settings/api" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          Go to API Dashboard
        </Link>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6">
        <Link
          href="/settings/api-keys"
          className="px-4 py-2 border-b-2 border-indigo-600 dark:border-indigo-400 font-medium text-sm text-indigo-600 dark:text-indigo-400"
        >
          API Keys
        </Link>
        <Link
          href="/settings/api-logs"
          className="px-4 py-2 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Request Logs
        </Link>
      </div>

      {showMigrationBanner && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex items-start justify-between gap-4">
            <div>
              <strong className="block">Existing keys updated</strong>
              <p className="mt-1 text-sm">
                Keys created before scoped permissions were added have been assigned write access.
                Review your keys and revoke or replace any that should be read-only.
              </p>
            </div>
            <button
              onClick={handleDismissMigrationBanner}
              className="text-sm text-gray-600 dark:text-gray-400 shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-md p-4 shadow-sm mb-6">
        <label className="block text-sm font-medium mb-2">Key Name</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
            placeholder="e.g. invoice-service"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-indigo-600 text-white px-4 py-2 rounded"
          >
            {isGenerating ? "Generating..." : "Generate Key"}
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium mb-2">Permission scope</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="read"
                checked={scope === "read"}
                onChange={() => setScope("read")}
              />
              Read-only
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="write"
                checked={scope === "write"}
                onChange={() => setScope("write")}
              />
              Write
            </label>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Read-only keys can access read endpoints. Write keys are required for mutating operations.
          </p>
        </fieldset>

        <p className="text-sm text-muted-foreground mt-2">Generated keys are shown only once.</p>
      </div>

      {showNewKey && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-start justify-between">
            <div>
              <strong className="block">New API Key</strong>
              <p className="mt-1 text-sm">Save this key now — you won&apos;t be able to see it again.</p>
              <div className="mt-3 flex gap-2 items-center">
                <code className="bg-white px-3 py-1 rounded break-all">{showNewKey}</code>
                <button
                  onClick={() => handleCopy(showNewKey)}
                  className="ml-2 bg-gray-800 text-white px-3 py-1 rounded"
                >
                  Copy
                </button>
              </div>
            </div>
            <div>
              <button
                onClick={() => setShowNewKey(null)}
                className="text-sm text-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {keys.length === 0 && <p className="text-sm text-gray-600">No API keys created yet.</p>}
        {keys.map((k) => (
          <div key={k.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-neutral-900 p-3 rounded shadow-sm">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="font-medium">{k.name}</div>
                <ScopeBadge scope={k.scope} />
                <div className="text-xs text-gray-500">{new Date(k.createdAt).toLocaleString()}</div>
              </div>
              <div className="text-sm text-gray-600 mt-1 break-all">
                {showNewKey === k.key ? (
                  <span>{k.key}</span>
                ) : (
                  <span>{maskKey(k.key)}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">Last used: {k.lastUsed ? new Date(k.lastUsed).toLocaleString() : "Never"}</div>
            </div>
            <div className="mt-3 sm:mt-0 sm:ml-4 flex gap-2">
              <button
                onClick={() => handleCopy(k.key)}
                className="px-3 py-1 border rounded text-sm"
              >
                Copy
              </button>
              <button
                onClick={() => handleRevoke(k.id)}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
