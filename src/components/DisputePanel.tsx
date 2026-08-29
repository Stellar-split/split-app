"use client";

import { useState, useRef } from "react";
import type { Invoice } from "@stellar-split/sdk";
import { truncateAddress } from "@stellar-split/sdk";
import { uploadToIpfs } from "@/lib/ipfs";
import { getSplitClient } from "@/lib/stellar";
import ArbitratorPicker from "@/components/ArbitratorPicker";

interface DisputeMetadata {
  reason: string;
  description: string;
  initiator: string;
  timestamp: number;
  arbitrators: string[];
  evidenceLinks: Array<{ cid: string; timestamp: number; submitter: string; filename: string }>;
}

interface DisputeVoteTally {
  releaseVotes: number;
  refundVotes: number;
  votedArbitrators: string[];
}

interface DisputeStatus extends DisputeMetadata, DisputeVoteTally {
  resolved: boolean;
  outcome?: "Release" | "Refund";
}

interface Props {
  invoice: Invoice;
  publicKey: string;
  onRefresh?: () => Promise<void>;
}

/**
 * DisputePanel — Full arbitration interface for Disputed invoices.
 * Shows dispute metadata, allows evidence submission via IPFS,
 * and enables authorized arbitrators to vote on dispute outcome.
 */
export default function DisputePanel({ invoice, publicKey, onRefresh }: Props) {
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Only render for Disputed invoices
  if ((invoice.status as string) !== "Disputed") return null;

  // Access dispute data from extended invoice type
  const dispute = (invoice as Invoice & { disputeStatus?: DisputeStatus }).disputeStatus;
  if (!dispute) return null;

  const isArbitrator = dispute.arbitrators.includes(publicKey);
  const hasVoted = dispute.votedArbitrators.includes(publicKey);

  const handleVote = async (voteType: "Release" | "Refund") => {
    if (!isArbitrator || hasVoted) return;

    setVoteError(null);
    setVoting(true);

    try {
      const client = getSplitClient();
      await (client as any).voteDispute({
        invoiceId: invoice.id,
        arbitrator: publicKey,
        vote: voteType === "Release" ? 1 : 0,
      });

      // Show success toast
      if (typeof window !== "undefined" && (window as any).__toastContainer?.addToast) {
        (window as any).__toastContainer.addToast(`Vote "${voteType}" submitted successfully`, "success");
      }

      // Refresh invoice data
      if (onRefresh) await onRefresh();
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : String(err));
    } finally {
      setVoting(false);
    }
  };

  const totalVotes = dispute.releaseVotes + dispute.refundVotes;
  const releasePercent = totalVotes > 0 ? (dispute.releaseVotes / totalVotes) * 100 : 0;
  const refundPercent = totalVotes > 0 ? (dispute.refundVotes / totalVotes) * 100 : 0;

  return (
    <>
      <section
        className="mb-8 border-2 border-red-500/50 rounded-2xl bg-red-950/20 p-6"
        aria-labelledby="dispute-panel-heading"
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 id="dispute-panel-heading" className="text-xl font-bold text-red-400 mb-2">
              ⚠️ Invoice Disputed
            </h2>
            <p className="text-sm text-gray-400">
              This invoice is under arbitration review
            </p>
          </div>
          {dispute.resolved && (
            <span
              className={`px-4 py-2 rounded-full text-sm font-bold ${
                dispute.outcome === "Release"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-orange-500/20 text-orange-400"
              }`}
            >
              {dispute.outcome === "Release" ? "✓ Approved" : "↩️ Refunded"}
            </span>
          )}
        </div>

        {/* Dispute Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reason</p>
            <p className="text-sm font-medium text-white">{dispute.reason}</p>
          </div>
          <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Initiated By</p>
            <p className="text-sm font-mono text-gray-200">{truncateAddress(dispute.initiator)}</p>
          </div>
          <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Date Filed</p>
            <p className="text-sm text-gray-200">
              {new Date(dispute.timestamp * 1000).toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Arbitrators</p>
            <p className="text-sm text-gray-200">{dispute.arbitrators.length} assigned</p>
          </div>
        </div>

        {/* Description */}
        {dispute.description && (
          <div className="mb-6 bg-gray-900/60 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Description</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{dispute.description}</p>
          </div>
        )}

        {/* Vote Tally */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Live Vote Tally</h3>
            <span className="text-xs text-gray-500">
              {totalVotes} of {dispute.arbitrators.length} votes cast
            </span>
          </div>

          <div className="space-y-3">
            {/* Release Votes */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-green-400 font-medium">✓ Approve Release</span>
                <span className="text-green-400 font-bold">{dispute.releaseVotes}</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${releasePercent}%` }}
                />
              </div>
            </div>

            {/* Refund Votes */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-orange-400 font-medium">↩️ Reject / Refund</span>
                <span className="text-orange-400 font-bold">{dispute.refundVotes}</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${refundPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Arbitrator Actions */}
        {isArbitrator && !dispute.resolved && (
          <div className="mb-6 bg-indigo-950/30 border-2 border-indigo-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">⚖️</span>
              <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wide">
                Arbitrator Actions
              </h3>
            </div>

            {hasVoted ? (
              <p className="text-sm text-gray-400">
                ✓ You have already cast your vote on this dispute.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-300 mb-4">
                  As an assigned arbitrator, you can vote to approve release of funds or reject and refund.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleVote("Release")}
                    disabled={voting}
                    className="flex-1 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Vote to approve release"
                  >
                    {voting ? "Submitting..." : "✓ Approve Release"}
                  </button>
                  <button
                    onClick={() => handleVote("Refund")}
                    disabled={voting}
                    className="flex-1 px-4 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Reject / Refund"
                  >
                    {voting ? "Submitting..." : "↩️ Reject / Refund"}
                  </button>
                </div>
                {voteError && (
                  <p role="alert" className="text-red-400 text-sm mt-3">
                    {voteError}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Evidence Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Evidence Submitted</h3>
            <button
              onClick={() => setShowEvidenceModal(true)}
              disabled={dispute.resolved}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Submit evidence"
            >
              + Submit Evidence
            </button>
          </div>

          {dispute.evidenceLinks.length === 0 ? (
            <p className="text-sm text-gray-500 bg-gray-900/40 border border-gray-700 rounded-lg p-4 text-center">
              No evidence submitted yet
            </p>
          ) : (
            <div className="space-y-2">
              {dispute.evidenceLinks.map((evidence, idx) => (
                <div
                  key={idx}
                  className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 flex items-start justify-between gap-3 hover:bg-gray-900/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate mb-1">
                      📎 {evidence.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      Submitted by {truncateAddress(evidence.submitter)} •{" "}
                      {new Date(evidence.timestamp * 1000).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={`https://ipfs.io/ipfs/${evidence.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-xs text-indigo-400 font-medium transition-colors shrink-0"
                    aria-label={`View evidence ${evidence.filename}`}
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Arbitrators List */}
        <ArbitratorPicker
          arbitrators={dispute.arbitrators.map((address) => ({
            address,
            name: truncateAddress(address),
            resolvedDisputeCount: null,
          }))}
          selectedAddress=""
          onSelect={() => {}}
          disabled={true}
          showVoteStatus={true}
          votedArbitrators={dispute.votedArbitrators}
        />
      </section>

      {/* Evidence Upload Modal */}
      {showEvidenceModal && (
        <EvidenceUploadModal
          invoiceId={invoice.id}
          publicKey={publicKey}
          onClose={() => {
            setShowEvidenceModal(false);
            setUploadError(null);
          }}
          onSuccess={async () => {
            setShowEvidenceModal(false);
            if (onRefresh) await onRefresh();
          }}
        />
      )}
    </>
  );
}

interface EvidenceUploadModalProps {
  invoiceId: string;
  publicKey: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

function EvidenceUploadModal({ invoiceId, publicKey, onClose, onSuccess }: EvidenceUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Limit file size to 10MB
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size must be under 10MB");
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Upload to IPFS
      const cid = await uploadToIpfs(file);

      // Submit evidence to contract
      const client = getSplitClient();
      await (client as any).addDisputeEvidence({
        invoiceId,
        submitter: publicKey,
        evidenceCid: cid,
        filename: file.name,
      });

      // Show success toast
      if (typeof window !== "undefined" && (window as any).__toastContainer?.addToast) {
        (window as any).__toastContainer.addToast("Evidence submitted successfully", "success");
      }

      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload evidence");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 id="evidence-modal-title" className="text-lg font-bold text-white">
            Submit Evidence
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Upload supporting documents to IPFS. Accepted: PDF, images, text files (max 10MB).
        </p>

        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.txt,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Select file"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-600 hover:border-indigo-500 bg-gray-800/50 hover:bg-gray-800 transition-colors text-sm text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {file ? `📎 ${file.name}` : "Click to select file"}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-red-400 text-sm mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Submit Evidence"}
          </button>
        </div>
      </div>
    </div>
  );
}
