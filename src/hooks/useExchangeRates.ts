import { useState, useEffect } from 'react';

export interface ExchangeRates {
  [key: string]: number;
}

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates>({
    XLM: 0.1,
    USDC: 1.0,
    EUR: 0.92,
    GBP: 0.79,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        setLoading(true);
        // Fetch from exchange rate API or use cached rates
        const response = await fetch('/api/exchange-rates');
        if (response.ok) {
          const data = await response.json();
          setRates(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch rates');
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  const getRate = (asset: string): number => {
    return rates[asset] || 1.0;
  };

  return { rates, loading, error, getRate };
}
