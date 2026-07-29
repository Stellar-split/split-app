'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import DisconnectModal from '@/components/wallet/DisconnectModal';

export default function WalletMenu() {
  const router = useRouter();
  const { address, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  if (!address) return null;

  const truncatedAddress = `${address.slice(0, 8)}...${address.slice(-6)}`;

  const handleDisconnect = async () => {
    await disconnect();
    setShowDisconnectModal(false);
    router.push('/');
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {truncatedAddress}
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
              <button
                onClick={() => {
                  const explorerUrl =
                    process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
                      ? `https://stellar.expert/explorer/public/account/${address}`
                      : `https://stellar.expert/explorer/testnet/account/${address}`;
                  window.open(explorerUrl, '_blank');
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.343a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM15.657 14.657a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM11 17a1 1 0 102 0v-1a1 1 0 10-2 0v1zM5.343 15.657a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414l-.707.707zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zM5.343 5.343a1 1 0 01-1.414 1.414l-.707-.707A1 1 0 014.636 4.636l.707.707zM10 6a4 4 0 100 8 4 4 0 000-8zm0 2a2 2 0 110 4 2 2 0 010-4z" />
                </svg>
                View on Explorer
              </button>
              <div className="border-t border-gray-700" />
              <button
                onClick={() => {
                  setShowDisconnectModal(true);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/40 transition-colors flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414-1.414L13.414 10l1.293-1.293a1 1 0 00-1.414-1.414L12 8.586l-1.293-1.293a1 1 0 00-1.414 1.414L10.586 10l-1.293 1.293a1 1 0 001.414 1.414L12 11.414l1.293 1.293z"
                    clipRule="evenodd"
                  />
                </svg>
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>

      <DisconnectModal
        open={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        onConfirm={handleDisconnect}
        walletAddress={address}
      />
    </>
  );
}
