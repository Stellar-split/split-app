import { useState, useEffect, useCallback, useRef } from "react";
import { searchAddressHistory } from "@/lib/invoiceHistory";
import { getAddressBook } from "@/lib/addressBook";

/**
 * Derives a smart label suggestion for a Stellar address or Federation address:
 * (1) Resolves federation addresses via stellar-sdk FederationServer
 * (2) Fetches account home_domain's stellar.toml for name metadata
 * (3) Falls back to the most common label/alias from past invoice history or local address book
 */
export async function resolveAddressLabel(address: string): Promise<string | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  // 1. Resolve federation address (e.g., user*domain.com or *domain.com)
  if (trimmed.includes("*")) {
    try {
      const { Federation } = await import("@stellar/stellar-sdk");
      const record = await Federation.Server.resolve(trimmed);
      if (record) {
        const username = trimmed.split("*")[0];
        if (username && username.length > 0) {
          // Capitalize first letter of username for clean label
          return username.charAt(0).toUpperCase() + username.slice(1);
        }
        const domain = trimmed.split("*")[1];
        if (domain) {
          return `${domain} Federation`;
        }
        return trimmed;
      }
    } catch {
      // Fall through on federation lookup failure
    }
  }

  // 2. Fetch home_domain & stellar.toml for G-addresses
  if (trimmed.startsWith("G") && trimmed.length === 56) {
    try {
      const horizonUrl =
        process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
      const res = await fetch(`${horizonUrl}/accounts/${trimmed}`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const accountData = await res.json();
        const homeDomain = accountData.home_domain;
        if (homeDomain) {
          try {
            const tomlRes = await fetch(`https://${homeDomain}/.well-known/stellar.toml`);
            if (tomlRes.ok) {
              const text = await tomlRes.text();
              const orgMatch =
                text.match(/ORG_NAME\s*=\s*"([^"]+)"/) ||
                text.match(/NAME\s*=\s*"([^"]+)"/);
              if (orgMatch && orgMatch[1]) {
                return orgMatch[1];
              }
            }
          } catch {
            // ignore toml fetch error
          }
          return homeDomain;
        }
      }
    } catch {
      // ignore Horizon network error
    }
  }

  // 3. Fall back to most-common label from past invoice data or address book
  try {
    const book = getAddressBook();
    const bookMatch = book.find(
      (b) => b.address.toLowerCase() === trimmed.toLowerCase()
    );
    if (bookMatch && bookMatch.nickname) {
      return bookMatch.nickname;
    }

    const history = searchAddressHistory(trimmed);
    const historyMatch = history.find(
      (h) => h.address.toLowerCase() === trimmed.toLowerCase()
    );
    if (historyMatch) {
      return `Recipient (${trimmed.slice(0, 6)}…)`;
    }
  } catch {
    // ignore storage error
  }

  return null;
}

export interface UseAddressLabelReturn {
  suggestedLabel: string;
  loading: boolean;
  error: string | null;
  resolveLabel: (addr: string) => Promise<string | null>;
}

/**
 * Custom hook to manage address label suggestions within 300 ms responsiveness.
 */
export function useAddressLabel(address?: string): UseAddressLabelReturn {
  const [suggestedLabel, setSuggestedLabel] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const lastResolvedRef = useRef<string>("");

  const resolveLabel = useCallback(async (addr: string): Promise<string | null> => {
    if (!addr || !addr.trim()) {
      setSuggestedLabel("");
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const label = await resolveAddressLabel(addr);
      if (label) {
        setSuggestedLabel(label);
      }
      return label;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address && address !== lastResolvedRef.current) {
      lastResolvedRef.current = address;
      const timer = setTimeout(() => {
        resolveLabel(address);
      }, 150); // <= 300 ms response time
      return () => clearTimeout(timer);
    }
  }, [address, resolveLabel]);

  return {
    suggestedLabel,
    loading,
    error,
    resolveLabel,
  };
}
