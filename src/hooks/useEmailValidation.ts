'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface ValidationResult {
  valid: boolean;
  hasMX: boolean;
}

interface CacheEntry {
  result: ValidationResult;
  timestamp: number;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const domainCache = new Map<string, CacheEntry>();

export function useEmailValidation(email: string, debounceMs = 500) {
  const [isValidFormat, setIsValidFormat] = useState(false);
  const [isCheckingMX, setIsCheckingMX] = useState(false);
  const [mxValid, setMxValid] = useState<boolean | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkEmail = useCallback(async () => {
    if (!email) {
      setIsValidFormat(false);
      setMxValid(null);
      return;
    }

    const formatValid = EMAIL_PATTERN.test(email);
    setIsValidFormat(formatValid);

    if (!formatValid) {
      setMxValid(null);
      return;
    }

    const domain = email.split('@')[1];
    const now = Date.now();
    const cached = domainCache.get(domain);

    if (cached && now - cached.timestamp < CACHE_TTL) {
      setMxValid(cached.result.hasMX);
      return;
    }

    setIsCheckingMX(true);
    try {
      const response = await fetch('/api/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        setMxValid(null);
        return;
      }

      const result: ValidationResult = await response.json();
      domainCache.set(domain, { result, timestamp: now });
      setMxValid(result.hasMX);
    } catch {
      setMxValid(null);
    } finally {
      setIsCheckingMX(false);
    }
  }, [email]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(checkEmail, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [email, debounceMs, checkEmail]);

  return {
    isValidFormat,
    isCheckingMX,
    mxValid,
  };
}
