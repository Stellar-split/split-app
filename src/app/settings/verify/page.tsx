'use client';

import { useEffect, useState } from 'react';
import { getFreighterPublicKey } from '@/lib/freighter';
import {
  generateChallenge,
  storeAttestation,
  getAttestation,
  removeAttestation,
  type CreatorAttestation,
} from '@/lib/attestation';
import {
  getRequestByAddress,
  submitVerificationRequest,
  isValidUrl,
  type VerificationRequest,
} from '@/lib/verificationRequests';

export default function VerifyIdentityPage() {
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [attestation, setAttestation] = useState<CreatorAttestation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadWalletAndAttestation();
  }, []);

  const loadWalletAndAttestation = async () => {
    try {
      const pubKey = await getFreighterPublicKey();
      setAddress(pubKey);
      
      if (pubKey) {
        const existing = getAttestation(pubKey);
        setAttestation(existing);
        const existingRequest = getRequestByAddress(pubKey);
        setVerificationRequest(existingRequest);
      }
    } catch (err) {
      setError('Failed to connect to Freighter wallet. Please install Freighter extension.');
    }
  };

  const handleVerify = async () => {
    if (!address) {
      setError('No wallet connected');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Generate challenge message
      const challenge = generateChallenge(address);

      // Sign with Freighter
      const { signMessage } = await import('@stellar/freighter-api');
      const signedMessage = await signMessage(challenge, {
        address,
        networkPassphrase:
          process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
            ? 'Public Global Stellar Network ; September 2015'
            : 'Test SDF Network ; September 2015',
      });

      // Store attestation
      const newAttestation: CreatorAttestation = {
        address,
        signature: typeof signedMessage === "string" ? signedMessage : ((signedMessage as unknown as { signature: string }).signature ?? String(signedMessage)),
        timestamp: Date.now(),
      };

      storeAttestation(newAttestation);
      setAttestation(newAttestation);
      setSuccess('Identity verified successfully! Your invoices will now show a "Verified Creator" badge.');
    } catch (err: any) {
      if (err?.message?.includes('User declined')) {
        setError('Verification cancelled. Please approve the signature request to verify your identity.');
      } else {
        setError(`Verification failed: ${err?.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    if (!address) return;
    
    removeAttestation(address);
    setAttestation(null);
    setSuccess('Verification removed successfully.');
  };

  const handleAddLink = () => {
    setLinkError(null);
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setLinkError("Please enter a valid URL (must start with http:// or https://).");
      return;
    }
    setLinks([...links, trimmed]);
    setLinkInput("");
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleSubmitRequest = () => {
    if (!address) return;
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const request = submitVerificationRequest(address, displayName, links);
      setVerificationRequest(request);
      setSubmitSuccess(true);
      setDisplayName("");
      setLinks([]);
      setLinkInput("");
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to submit verification request.");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getExpiryDate = (timestamp: number) => {
    const expiryDate = new Date(timestamp + 30 * 24 * 60 * 60 * 1000);
    return expiryDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <a
            href="/dashboard"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
          >
            ← Back to Dashboard
          </a>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Verify Your Identity</h1>
        <p className="text-gray-400 mb-8">
          Prove your identity as an invoice creator by signing a message with your Freighter wallet.
          Verified creators display a badge on their invoices, building trust with recipients.
        </p>

        {/* Wallet Status */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Wallet Status</h2>
          {address ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Connected Address:</span>
                <span className="font-mono text-sm text-gray-200 break-all">{address}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-yellow-400">
              No wallet connected. Please install and unlock Freighter.
            </div>
          )}
        </div>

        {/* Verification Status */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Verification Status</h2>
          
          {attestation ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-green-900 text-green-300">
                  ✓ Verified Creator
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-gray-400">Verified on:</span>
                  <span className="text-gray-200">{formatDate(attestation.timestamp)}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-gray-400">Expires on:</span>
                  <span className="text-gray-200">{getExpiryDate(attestation.timestamp)}</span>
                </div>
              </div>

              <button
                onClick={handleRemove}
                className="mt-4 px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded-lg transition-colors text-sm"
              >
                Remove Verification
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-gray-700 text-gray-400">
                  ○ Not Verified
                </span>
              </div>
              
              <p className="text-sm text-gray-400">
                You haven&apos;t verified your identity yet. Click the button below to sign a verification message.
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        {!attestation && address && (
          <button
            onClick={handleVerify}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
          >
            {loading ? 'Verifying...' : 'Verify Identity'}
          </button>
        )}

        {/* Messages */}
        {error && (
          <div className="mt-6 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 p-4 bg-green-900/20 border border-green-900 rounded-lg text-green-300 text-sm">
            {success}
          </div>
        )}

        {/* How It Works */}
        <div className="mt-8 bg-gray-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">How It Works</h2>
          <ol className="space-y-3 text-sm text-gray-400">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center text-xs">
                1
              </span>
              <span>
                Click &quot;Verify Identity&quot; to generate a unique challenge message containing your wallet address and timestamp.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center text-xs">
                2
              </span>
              <span>
                Sign the message using your Freighter wallet. This proves you control the wallet address.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center text-xs">
                3
              </span>
              <span>
                Your signed attestation is stored locally in your browser. It expires after 30 days.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center text-xs">
                4
              </span>
              <span>
                Invoices you create will display a &quot;Verified Creator&quot; badge, building trust with recipients.
              </span>
            </li>
          </ol>
        </div>

        {/* Divider */}
        <div className="mt-10 mb-10 border-t border-gray-800" />

        {/* Request Creator Verification */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Request Creator Verification</h2>
          <p className="text-sm text-gray-400 mb-6">
            Submit a verification request for manual review. Provide your display name and optional
            links to your social profiles or website so an admin can verify your identity.
          </p>

          {verificationRequest?.status === "pending" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-amber-900 text-amber-300">
                  ⏳ Pending review
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-gray-400">Display Name:</span>
                  <span className="text-gray-200">{verificationRequest.displayName}</span>
                </div>
                {verificationRequest.links.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-400">Links:</span>
                    <ul className="list-disc list-inside text-gray-200 ml-2">
                      {verificationRequest.links.map((link, i) => (
                        <li key={i}>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 break-all"
                          >
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-gray-400">Submitted:</span>
                  <span className="text-gray-200">{formatDate(verificationRequest.submittedAt)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {verificationRequest && (
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                      verificationRequest.status === "approved"
                        ? "bg-green-900 text-green-300"
                        : "bg-red-900 text-red-300"
                    }`}
                  >
                    {verificationRequest.status === "approved"
                      ? "✓ Previously approved"
                      : "✗ Previously denied"}
                  </span>
                  <span className="text-sm text-gray-400">
                    — you may submit a new request.
                  </span>
                </div>
              )}

              {!address ? (
                <p className="text-sm text-yellow-400">
                  Connect your wallet to submit a verification request.
                </p>
              ) : (
                <>
                  {/* Display Name */}
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1">
                      Display Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your display name"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>

                  {/* Links */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Links <span className="text-gray-500">(optional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={linkInput}
                        onChange={(e) => {
                          setLinkInput(e.target.value);
                          setLinkError(null);
                        }}
                        placeholder="https://example.com"
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddLink();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddLink}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm"
                      >
                        Add
                      </button>
                    </div>
                    {linkError && (
                      <p className="mt-1 text-sm text-red-400">{linkError}</p>
                    )}

                    {links.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {links.map((link, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <span className="text-indigo-400 break-all flex-1">{link}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(i)}
                              className="text-red-400 hover:text-red-300 text-xs flex-shrink-0"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="button"
                    onClick={handleSubmitRequest}
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
                  >
                    Submit Verification Request
                  </button>

                  {submitError && (
                    <div className="p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300 text-sm">
                      {submitError}
                    </div>
                  )}

                  {submitSuccess && (
                    <div className="p-4 bg-green-900/20 border border-green-900 rounded-lg text-green-300 text-sm">
                      Your verification request has been submitted and is pending review.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
