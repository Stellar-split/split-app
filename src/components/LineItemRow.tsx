'use client';

import AddressBookPicker from '@/components/settings/AddressBookPicker';
import Avatar from '@/components/ui/Avatar';
import EmailField from '@/components/EmailField';

export interface LineItemRowProps {
  index: number;
  address: string;
  amount: string;
  label?: string;
  email?: string;
  equalSplit?: boolean;
  amountOverride?: string;
  amountSuggestions?: string[];
  activeField?: 'address' | 'amount' | null;
  activeIndex?: number | null;
  canRemove: boolean;
  emailByAddress?: Record<string, string | undefined>;
  onAddressChange: (address: string, label?: string, email?: string) => void;
  onAmountChange: (amount: string) => void;
  onAmountFocus: () => void;
  onAmountSuggestionSelect: (amount: string) => void;
  onRemove: () => void;
  onEmailChange: (email: string) => void;
}

export default function LineItemRow({
  index,
  address,
  amount,
  label,
  email,
  equalSplit = false,
  amountOverride,
  amountSuggestions = [],
  activeField = null,
  activeIndex = null,
  canRemove,
  emailByAddress = {},
  onAddressChange,
  onAmountChange,
  onAmountFocus,
  onAmountSuggestionSelect,
  onRemove,
  onEmailChange,
}: LineItemRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start min-w-0">
        <Avatar
          address={address}
          email={emailByAddress[address]}
          size={32}
          className="mt-1.5 hidden sm:inline-flex"
        />

        <div className="relative flex-1 min-w-0 w-full">
          <AddressBookPicker
            value={address}
            label={label}
            onChange={(addr, lbl) => onAddressChange(addr, lbl ?? email, email)}
            placeholder="G... or name*domain.com address"
            ariaLabel={`Recipient ${index + 1} address`}
          />
        </div>

        <div className="relative w-full sm:w-28">
          <input
            type="number"
            placeholder="USDC"
            step="0.0000001"
            min="0.0000001"
            value={equalSplit ? (amountOverride ?? amount) : amount}
            onChange={
              equalSplit ? undefined : (e) => onAmountChange(e.target.value)
            }
            onFocus={() => !equalSplit && onAmountFocus()}
            readOnly={equalSplit}
            required
            aria-label={`Recipient ${index + 1} amount`}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 min-h-11 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              equalSplit
                ? 'border-gray-600 text-gray-400 cursor-not-allowed'
                : 'border-gray-700'
            }`}
          />
          {activeField === 'amount' && activeIndex === index && amountSuggestions.length > 0 && !equalSplit && (
            <ul className="absolute z-10 right-0 w-full bg-gray-800 border border-gray-700 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg">
              {amountSuggestions.map((amt) => (
                <li key={amt}>
                  <button
                    type="button"
                    onMouseDown={() => onAmountSuggestionSelect(amt)}
                    className="w-full min-h-11 text-left px-3 py-2 text-sm hover:bg-gray-700 font-mono text-gray-200"
                  >
                    {amt} USDC
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove recipient ${index + 1}`}
            className="min-h-11 px-3 py-2 rounded-lg bg-gray-700 hover:bg-red-700 text-sm transition-colors sm:self-start focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 min-w-0 w-full">
        <div className="hidden sm:block w-8" />
        <div className="flex-1">
          <EmailField
            email={email || ''}
            onEmailChange={onEmailChange}
            onBlur={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
