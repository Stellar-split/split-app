"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  avatarAltText,
  avatarColorFromAddress,
  avatarInitials,
  gravatarUrl,
} from "@/lib/avatar";

interface AvatarProps {
  /** Stellar public key — seeds the deterministic fallback avatar. */
  address: string;
  /** Optional stored email; when present we try Gravatar first. */
  email?: string;
  /** Rendered size in px (also the Gravatar request size, at 2× for retina). */
  size?: number;
  className?: string;
}

/**
 * Avatar — Gravatar with a deterministic colour fallback.
 *
 * Resolution order:
 *   1. Stored email → Gravatar (requested with `d=404`).
 *   2. No email, or Gravatar 404s → colour swatch derived from the address.
 *
 * A circular skeleton holds the space while a Gravatar request is in flight so
 * rows don't reflow when it resolves.
 */
export default function Avatar({ address, email, size = 32, className = "" }: AvatarProps) {
  const trimmedEmail = email?.trim();
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    trimmedEmail ? "loading" : "failed"
  );

  // Re-resolve when the row's identity changes (rows are reorderable, so the
  // same component instance can be handed a different recipient).
  useEffect(() => {
    setStatus(trimmedEmail ? "loading" : "failed");
  }, [trimmedEmail, address]);

  const alt = avatarAltText(address);
  const dimension = { width: size, height: size };

  if (!trimmedEmail || status === "failed") {
    return (
      <span
        data-testid="avatar-fallback"
        role="img"
        aria-label={alt}
        title={alt}
        style={{
          ...dimension,
          backgroundColor: avatarColorFromAddress(address),
          fontSize: Math.round(size * 0.4),
        }}
        className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${className}`}
      >
        {avatarInitials(address)}
      </span>
    );
  }

  return (
    <span
      style={dimension}
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className}`}
    >
      {status === "loading" && (
        <span
          data-testid="avatar-skeleton"
          aria-hidden="true"
          style={dimension}
          className="absolute inset-0 animate-pulse rounded-full bg-gray-300 dark:bg-gray-700"
        />
      )}
      <Image
        src={gravatarUrl(trimmedEmail, size * 2)}
        alt={alt}
        width={size}
        height={size}
        unoptimized
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
        className={`rounded-full object-cover transition-opacity ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
