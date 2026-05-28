'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { splitClient } from '@/lib/stellar';
import { getFreighterPublicKey } from '@/lib/freighter';
import { formatAmount } from '@stellar-split/sdk';
import InvoiceCard from '@/components/InvoiceCard';
import { SkeletonCard } from '@/components/Skeleton';
import type { Invoice } from '@stellar-split/sdk';

interface SearchFilters {
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  creator?: string;
  recipient?: string;
}

interface SavedSearch {
  name: string;
  filters: SearchFilters;
}

const STORAGE_KEY = 'stellarsplit-saved-searches';

function getSavedSearches(): SavedSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setSavedSearches(searches: SavedSearch[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
}

export default function SearchPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<SearchFilters>({});
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchName, setSearchName] = useState('');
  const [results, setResults] = useState<Invoice[]>([]);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setError('Connect your Freighter wallet to search invoices.'));
  }, []);

  useEffect(() => {
    setSavedSearches(getSavedSearches());
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    const fetchAndFilter = async () => {
      setLoading(true);
      try {
        const allInvoices: Invoice[] = [];
        let offset = 0;
        const limit = 100;

        while (true) {
          const batch = await (splitClient as any).listInvoices(publicKey, offset, limit);
          if (!batch || batch.length === 0) break;
          allInvoices.push(...batch);
          offset += limit;
        }

        setInvoices(allInvoices);

        // Apply filters
        const filtered = allInvoices.filter((inv) => {
          if (filters.status && inv.status !== filters.status) return false;

          const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
          const totalNum = Number(total) / 1e7;

          if (filters.minAmount && totalNum < filters.minAmount) return false;
          if (filters.maxAmount && totalNum > filters.maxAmount) return false;

          if (filters.dateFrom) {
            const fromTs = new Date(filters.dateFrom).getTime() / 1000;
            if (inv.deadline < fromTs) return false;
          }

          if (filters.dateTo) {
            const toTs = new Date(filters.dateTo).getTime() / 1000;
            if (inv.deadline > toTs) return false;
          }

          if (filters.creator && inv.creator.toLowerCase() !== filters.creator.toLowerCase()) {
            return false;
          }

          if (filters.recipient) {
            const hasRecipient = inv.recipients.some(
              (r) => r.address.toLowerCase() === filters.recipient!.toLowerCase()
            );
            if (!hasRecipient) return false;
          }

          return true;
        });

        setResults(filtered);
      } catch (err) {
        setError('Failed to fetch invoices');
      } finally {
        setLoading(false);
      }
    };

    fetchAndFilter();
  }, [publicKey, filters]);

  const handleSaveSearch = () => {
    if (!searchName.trim()) return;
    const updated = [
      ...savedSearches,
      { name: searchName, filters },
    ];
    setSavedSearches(updated);
    setSavedSearches(updated);
    setSearchName('');
  };

  const handleLoadSearch = (search: SavedSearch) => {
    setFilters(search.filters);
  };

  const handleDeleteSearch = (name: string) => {
    const updated = savedSearches.filter((s) => s.name !== name);
    setSavedSearches(updated);
    setSavedSearches(updated);
  };

  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">Advanced Search</h1>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-900 rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="Pending">Pending</option>
            <option value="Released">Released</option>
            <option value="Refunded">Refunded</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Min Amount (USDC)</label>
          <input
            type="number"
            value={filters.minAmount || ''}
            onChange={(e) => setFilters({ ...filters, minAmount: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Max Amount (USDC)</label>
          <input
            type="number"
            value={filters.maxAmount || ''}
            onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            placeholder="∞"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">From Date</label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">To Date</label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Creator Address</label>
          <input
            type="text"
            value={filters.creator || ''}
            onChange={(e) => setFilters({ ...filters, creator: e.target.value || undefined })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            placeholder="G..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Recipient Address</label>
          <input
            type="text"
            value={filters.recipient || ''}
            onChange={(e) => setFilters({ ...filters, recipient: e.target.value || undefined })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            placeholder="G..."
          />
        </div>
      </div>

      <div className="mb-8 bg-gray-900 rounded-lg p-4">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Search name..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button
            onClick={handleSaveSearch}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition-colors"
          >
            Save Search
          </button>
        </div>

        {savedSearches.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Saved Searches</p>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map((search) => (
                <div key={search.name} className="flex items-center gap-2 bg-gray-800 rounded px-3 py-1">
                  <button
                    onClick={() => handleLoadSearch(search)}
                    className="text-sm text-indigo-300 hover:text-indigo-200"
                  >
                    {search.name}
                  </button>
                  <button
                    onClick={() => handleDeleteSearch(search.name)}
                    className="text-xs text-gray-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-400">
          {loading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : results.length === 0 ? (
          <p className="text-gray-400 col-span-full">No invoices match your search.</p>
        ) : (
          results.map((inv) => (
            <Link key={inv.id} href={`/invoice/${inv.id}`}>
              <InvoiceCard invoice={inv} />
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
