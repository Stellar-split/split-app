"use client"

import React, { useEffect, useState } from "react"

type ApiKey = {
  id: string
  name: string
  key: string
  createdAt: number
  lastUsed?: number | null
}

const STORAGE_KEY = "apiKeys"

function loadKeys(): ApiKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ApiKey[]
  } catch (e) {
    return []
  }
}

function saveKeys(keys: ApiKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

function maskKey(key: string) {
  if (!key) return ""
  // show prefix then masked middle and trailing stars
  const prefix = key.startsWith("sk_") ? "sk_" : ""
  const rest = key.slice(prefix.length)
  if (rest.length <= 8) return prefix + "****...****"
  const start = rest.slice(0, 2)
  const end = rest.slice(-2)
  return `${prefix}${start}****...****${end}`
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [name, setName] = useState("")
  const [showNewKey, setShowNewKey] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    setKeys(loadKeys())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    saveKeys(keys)
  }, [keys])

  function handleGenerate() {
    if (!name.trim()) {
      alert("Please provide a name for the key")
      return
    }
    const id = crypto.randomUUID()
    const key = `sk_${crypto.randomUUID()}`
    const item: ApiKey = { id, name: name.trim(), key, createdAt: Date.now(), lastUsed: null }
    const updated = [item, ...keys]
    setKeys(updated)
    setShowNewKey(key)
    setName("")
  }

  function handleRevoke(id: string) {
    if (!confirm("Revoke this API key?")) return
    const updated = keys.filter((k) => k.id !== id)
    setKeys(updated)
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard"))
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">API Keys</h1>

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
            className="bg-indigo-600 text-white px-4 py-2 rounded"
          >
            Generate Key
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">Generated keys are shown only once.</p>
      </div>

      {showNewKey && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-start justify-between">
            <div>
              <strong className="block">New API Key</strong>
              <p className="mt-1 text-sm">Save this key now — you won't be able to see it again.</p>
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
