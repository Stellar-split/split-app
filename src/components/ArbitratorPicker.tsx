"use client";

import { truncateAddress } from "@stellar-split/sdk";

interface Arbitrator {
  address: string;
  name: string;
  resolvedDisputeCount: number | null;
}

interface Props {
  /** List of arbitrators to display */
  arbitrators: Arbitrator[];
  /** Currently selected arbitrator address */
  selectedAddress: string;
  /** Callback when an arbitrator is selected */
  onSelect: (address: string) => void;
  /** Whether the component is disabled (e.g., dispute resolved) */
  disabled?: boolean;
  /** Heading text (defaults to "Assigned Arbitrators") */
  heading?: string;
  /** Show vote status badges (default: false) */
  showVoteStatus?: boolean;
  /** List of arbitrators who have voted (used when showVoteStatus is true) */
  votedArbitrators?: string[];
  /**
   * Enable assignment mode: a multi-select list used by the dispute wizard
   * and panel to choose the arbitrators for a dispute.
   */
  assignmentMode?: boolean;
  /** Addresses currently selected for assignment (assignment mode only) */
  assignedAddresses?: string[];
  /** Callback when the assignment selection changes (assignment mode only) */
  onAssign?: (addresses: string[]) => void;
  /** Maximum number of arbitrators that may be assigned (assignment mode only) */
  maxAssignments?: number;
}

/**
 * ArbitratorPicker — displays a selectable list of arbitrators.
 * Extracted from DisputePanel for reusability and testability.
 * Can show vote status badges and is fully typed.
 */
export default function ArbitratorPicker({
  arbitrators,
  selectedAddress,
  onSelect,
  disabled = false,
  heading = "Assigned Arbitrators",
  showVoteStatus = false,
  votedArbitrators = [],
  assignmentMode = false,
  assignedAddresses = [],
  onAssign,
  maxAssignments,
}: Props) {
  const atLimit =
    maxAssignments !== undefined && assignedAddresses.length >= maxAssignments;

  const toggleAssignment = (address: string) => {
    if (disabled || !onAssign) return;
    const isAssigned = assignedAddresses.includes(address);
    if (isAssigned) {
      onAssign(assignedAddresses.filter((a) => a !== address));
    } else {
      if (atLimit) return;
      onAssign([...assignedAddresses, address]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{heading}</h3>
        {assignmentMode && maxAssignments !== undefined && (
          <span className="text-xs text-gray-400">
            {assignedAddresses.length}/{maxAssignments} selected
          </span>
        )}
      </div>
      <div className="space-y-2">
        {arbitrators.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-900/40 border border-gray-700 rounded-lg p-4 text-center">
            {assignmentMode ? "No arbitrators available" : "No arbitrators assigned"}
          </p>
        ) : (
          arbitrators.map((arb) => {
            const isSelected = assignmentMode
              ? assignedAddresses.includes(arb.address)
              : arb.address === selectedAddress;
            const hasVoted = votedArbitrators.includes(arb.address);
            const isDisabled =
              disabled || (assignmentMode && !isSelected && atLimit);

            return (
              <button
                key={arb.address}
                type="button"
                onClick={() =>
                  assignmentMode
                    ? toggleAssignment(arb.address)
                    : !disabled && onSelect(arb.address)
                }
                disabled={isDisabled}
                aria-pressed={isSelected}
                className={`w-full p-3 rounded-lg border-2 transition-colors text-left disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {arb.name}
                    </p>
                    <p className="text-xs text-gray-400 font-mono truncate mt-0.5">
                      {truncateAddress(arb.address)}
                    </p>
                    {arb.resolvedDisputeCount !== null && (
                      <p className="text-xs text-gray-500 mt-1">
                        {arb.resolvedDisputeCount} resolved
                      </p>
                    )}
                  </div>

                  {assignmentMode ? (
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                        isSelected
                          ? "bg-indigo-500/20 text-indigo-300"
                          : "bg-gray-700/50 text-gray-500"
                      }`}
                    >
                      {isSelected ? "✓ Selected" : "Select"}
                    </span>
                  ) : (
                    showVoteStatus && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                          hasVoted
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-700/50 text-gray-500"
                        }`}
                      >
                        {hasVoted ? "✓ Voted" : "Pending"}
                      </span>
                    )
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
