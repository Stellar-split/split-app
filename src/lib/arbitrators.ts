export interface Arbitrator {
  address: string;
  name: string;
  resolvedDisputeCount: number | null;
}

const STORAGE_KEY = "stellarsplit_arbitrator_registry";

function getDefaultRegistry(): Arbitrator[] {
  return [
    {
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
      name: "StellarMediate",
      resolvedDisputeCount: 42,
    },
    {
      address: "GBBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
      name: "ChainResolve",
      resolvedDisputeCount: 17,
    },
    {
      address: "GBCCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
      name: "TrustArbitrators",
      resolvedDisputeCount: null,
    },
  ];
}

export function getArbitrators(): Arbitrator[] {
  if (typeof window === "undefined") return getDefaultRegistry();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultRegistry();
    const parsed = JSON.parse(raw) as Arbitrator[];
    return parsed.length > 0 ? parsed : getDefaultRegistry();
  } catch {
    return getDefaultRegistry();
  }
}

export function searchArbitrators(query: string): Arbitrator[] {
  const q = query.trim().toLowerCase();
  if (!q) return getArbitrators();
  return getArbitrators().filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.address.toLowerCase().includes(q),
  );
}

export function getArbitratorByAddress(address: string): Arbitrator | undefined {
  return getArbitrators().find((a) => a.address === address);
}

// ---------------------------------------------------------------------------
// Dispute resolution system
// ---------------------------------------------------------------------------

export type DisputeStatus =
  | "open"
  | "evidence"
  | "arbitration"
  | "resolved"
  | "enforced";

export type DisputeParty = "initiator" | "respondent";

export interface DisputeEvidence {
  id: string;
  submittedBy: string;
  party: DisputeParty;
  description: string;
  /** Optional reference (URL, hash, or free-form pointer) to the evidence. */
  reference?: string;
  submittedAt: string;
}

export type DisputeTimelineEventType =
  | "created"
  | "evidence_submitted"
  | "arbitrator_assigned"
  | "vote_recorded"
  | "resolved"
  | "enforced"
  | "status_changed";

export interface DisputeTimelineEvent {
  id: string;
  type: DisputeTimelineEventType;
  actor: string;
  message: string;
  at: string;
  metadata?: Record<string, unknown>;
}

export interface ArbitratorVote {
  arbitrator: string;
  /** Outcome the arbitrator voted for. */
  outcome: DisputeOutcome;
  /** Optional rationale for the vote. */
  rationale?: string;
  votedAt: string;
}

export type DisputeOutcome =
  | "favor_initiator"
  | "favor_respondent"
  | "split"
  | "dismissed";

export interface DisputeResolution {
  outcome: DisputeOutcome;
  /** Human readable summary of the decision. */
  summary: string;
  /** Optional amount (in the invoice currency) to be awarded. */
  awardedAmount?: number;
  resolvedBy: string;
  resolvedAt: string;
  enforced: boolean;
  enforcedAt?: string;
  enforcedBy?: string;
}

export interface DisputeRecord {
  id: string;
  invoiceId: string;
  initiator: string;
  respondent: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  assignedArbitrators: string[];
  evidence: DisputeEvidence[];
  votes: ArbitratorVote[];
  timeline: DisputeTimelineEvent[];
  resolution?: DisputeResolution;
  createdAt: string;
  updatedAt: string;
}

const DISPUTES_STORAGE_KEY = "stellarsplit_disputes";

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readAllDisputes(): DisputeRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(DISPUTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DisputeRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAllDisputes(disputes: DisputeRecord[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(DISPUTES_STORAGE_KEY, JSON.stringify(disputes));
  } catch {
    // Ignore persistence failures (quota, private mode, etc.)
  }
}

function appendTimeline(
  dispute: DisputeRecord,
  type: DisputeTimelineEventType,
  actor: string,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  dispute.timeline.push({
    id: generateId("evt"),
    type,
    actor,
    message,
    at: nowIso(),
    metadata,
  });
}

function touch(dispute: DisputeRecord): void {
  dispute.updatedAt = nowIso();
}

function saveDispute(dispute: DisputeRecord): DisputeRecord {
  const all = readAllDisputes();
  const idx = all.findIndex((d) => d.id === dispute.id);
  if (idx >= 0) {
    all[idx] = dispute;
  } else {
    all.push(dispute);
  }
  writeAllDisputes(all);
  return dispute;
}

export function getDisputes(): DisputeRecord[] {
  return readAllDisputes();
}

export function getDisputeById(id: string): DisputeRecord | undefined {
  return readAllDisputes().find((d) => d.id === id);
}

export function getDisputesByInvoice(invoiceId: string): DisputeRecord[] {
  return readAllDisputes().filter((d) => d.invoiceId === invoiceId);
}

export function getDisputesByParty(address: string): DisputeRecord[] {
  return readAllDisputes().filter(
    (d) => d.initiator === address || d.respondent === address,
  );
}

export interface CreateDisputeInput {
  invoiceId: string;
  initiator: string;
  respondent: string;
  reason: string;
  description: string;
}

export function createDispute(input: CreateDisputeInput): DisputeRecord {
  const invoiceId = input.invoiceId?.trim();
  const initiator = input.initiator?.trim();
  const respondent = input.respondent?.trim();
  const reason = input.reason?.trim();
  const description = input.description?.trim();

  if (!invoiceId) throw new Error("Invoice ID is required");
  if (!initiator) throw new Error("Initiator address is required");
  if (!respondent) throw new Error("Respondent address is required");
  if (initiator === respondent) {
    throw new Error("Initiator and respondent must be different parties");
  }
  if (!reason) throw new Error("Dispute reason is required");
  if (!description) throw new Error("Dispute description is required");

  const existing = readAllDisputes().find(
    (d) =>
      d.invoiceId === invoiceId &&
      d.status !== "resolved" &&
      d.status !== "enforced",
  );
  if (existing) {
    throw new Error("An active dispute already exists for this invoice");
  }

  const createdAt = nowIso();
  const dispute: DisputeRecord = {
    id: generateId("dsp"),
    invoiceId,
    initiator,
    respondent,
    reason,
    description,
    status: "open",
    assignedArbitrators: [],
    evidence: [],
    votes: [],
    timeline: [],
    createdAt,
    updatedAt: createdAt,
  };

  appendTimeline(
    dispute,
    "created",
    initiator,
    `Dispute opened for invoice ${invoiceId}: ${reason}`,
  );

  return saveDispute(dispute);
}

export interface SubmitEvidenceInput {
  disputeId: string;
  submittedBy: string;
  description: string;
  reference?: string;
}

export function submitEvidence(input: SubmitEvidenceInput): DisputeRecord {
  const dispute = getDisputeById(input.disputeId);
  if (!dispute) throw new Error("Dispute not found");
  if (dispute.status === "resolved" || dispute.status === "enforced") {
    throw new Error("Cannot submit evidence to a closed dispute");
  }

  const submittedBy = input.submittedBy?.trim();
  if (!submittedBy) throw new Error("Submitter address is required");

  let party: DisputeParty;
  if (submittedBy === dispute.initiator) {
    party = "initiator";
  } else if (submittedBy === dispute.respondent) {
    party = "respondent";
  } else {
    throw new Error("Only the involved parties may submit evidence");
  }

  const description = input.description?.trim();
  if (!description) throw new Error("Evidence description is required");

  const evidence: DisputeEvidence = {
    id: generateId("evd"),
    submittedBy,
    party,
    description,
    reference: input.reference?.trim() || undefined,
    submittedAt: nowIso(),
  };

  dispute.evidence.push(evidence);

  if (dispute.status === "open") {
    dispute.status = "evidence";
    appendTimeline(
      dispute,
      "status_changed",
      submittedBy,
      "Dispute moved to evidence phase",
      { status: "evidence" },
    );
  }

  appendTimeline(
    dispute,
    "evidence_submitted",
    submittedBy,
    `Evidence submitted by ${party}`,
    { evidenceId: evidence.id },
  );

  touch(dispute);
  return saveDispute(dispute);
}

export function assignArbitrator(
  disputeId: string,
  arbitratorAddress: string,
  actor?: string,
): DisputeRecord {
  const dispute = getDisputeById(disputeId);
  if (!dispute) throw new Error("Dispute not found");
  if (dispute.status === "resolved" || dispute.status === "enforced") {
    throw new Error("Cannot assign arbitrators to a closed dispute");
  }

  const address = arbitratorAddress?.trim();
  if (!address) throw new Error("Arbitrator address is required");

  const known = getArbitratorByAddress(address);
  if (!known) throw new Error("Arbitrator is not in the registry");

  if (dispute.assignedArbitrators.includes(address)) {
    throw new Error("Arbitrator is already assigned to this dispute");
  }

  dispute.assignedArbitrators.push(address);

  if (dispute.status === "open" || dispute.status === "evidence") {
    dispute.status = "arbitration";
    appendTimeline(
      dispute,
      "status_changed",
      actor ?? address,
      "Dispute moved to arbitration phase",
      { status: "arbitration" },
    );
  }

  appendTimeline(
    dispute,
    "arbitrator_assigned",
    actor ?? address,
    `Arbitrator ${known.name} assigned`,
    { arbitrator: address },
  );

  touch(dispute);
  return saveDispute(dispute);
}

/**
 * Assigns a set of arbitrators to a dispute. Skips arbitrators that are
 * already assigned and validates each against the registry.
 */
export function assignArbitrators(
  disputeId: string,
  arbitratorAddresses: string[],
  actor?: string,
): DisputeRecord {
  if (!Array.isArray(arbitratorAddresses) || arbitratorAddresses.length === 0) {
    throw new Error("At least one arbitrator address is required");
  }

  let dispute = getDisputeById(disputeId);
  if (!dispute) throw new Error("Dispute not found");

  for (const address of arbitratorAddresses) {
    const trimmed = address?.trim();
    if (!trimmed) continue;
    if (dispute.assignedArbitrators.includes(trimmed)) continue;
    dispute = assignArbitrator(disputeId, trimmed, actor);
  }

  return dispute;
}

export function getAssignedArbitrators(disputeId: string): Arbitrator[] {
  const dispute = getDisputeById(disputeId);
  if (!dispute) return [];
  return dispute.assignedArbitrators
    .map((address) => getArbitratorByAddress(address))
    .filter((a): a is Arbitrator => Boolean(a));
}

export interface RecordVoteInput {
  disputeId: string;
  arbitrator: string;
  outcome: DisputeOutcome;
  rationale?: string;
}

export function recordVote(input: RecordVoteInput): DisputeRecord {
  const dispute = getDisputeById(input.disputeId);
  if (!dispute) throw new Error("Dispute not found");
  if (dispute.status === "resolved" || dispute.status === "enforced") {
    throw new Error("Cannot vote on a closed dispute");
  }

  const arbitrator = input.arbitrator?.trim();
  if (!arbitrator) throw new Error("Arbitrator address is required");
  if (!dispute.assignedArbitrators.includes(arbitrator)) {
    throw new Error("Only assigned arbitrators may vote");
  }
  if (dispute.votes.some((v) => v.arbitrator === arbitrator)) {
    throw new Error("Arbitrator has already voted on this dispute");
  }

  const validOutcomes: DisputeOutcome[] = [
    "favor_initiator",
    "favor_respondent",
    "split",
    "dismissed",
  ];
  if (!validOutcomes.includes(input.outcome)) {
    throw new Error("Invalid vote outcome");
  }

  dispute.votes.push({
    arbitrator,
    outcome: input.outcome,
    rationale: input.rationale?.trim() || undefined,
    votedAt: nowIso(),
  });

  appendTimeline(
    dispute,
    "vote_recorded",
    arbitrator,
    `Arbitrator voted: ${input.outcome}`,
    { outcome: input.outcome },
  );

  touch(dispute);
  return saveDispute(dispute);
}

export interface ResolveDisputeInput {
  disputeId: string;
  outcome: DisputeOutcome;
  summary: string;
  awardedAmount?: number;
  resolvedBy: string;
}

export function resolveDispute(input: ResolveDisputeInput): DisputeRecord {
  const dispute = getDisputeById(input.disputeId);
  if (!dispute) throw new Error("Dispute not found");
  if (dispute.status === "resolved" || dispute.status === "enforced") {
    throw new Error("Dispute is already resolved");
  }
  if (dispute.assignedArbitrators.length === 0) {
    throw new Error("Cannot resolve a dispute without assigned arbitrators");
  }
  if (dispute.votes.length === 0) {
    throw new Error("Cannot resolve a dispute without arbitrator votes");
  }

  const summary = input.summary?.trim();
  if (!summary) throw new Error("Resolution summary is required");

  const resolvedBy = input.resolvedBy?.trim();
  if (!resolvedBy) throw new Error("Resolver address is required");
  if (!dispute.assignedArbitrators.includes(resolvedBy)) {
    throw new Error("Only assigned arbitrators may resolve the dispute");
  }

  if (
    input.awardedAmount !== undefined &&
    (Number.isNaN(input.awardedAmount) || input.awardedAmount < 0)
  ) {
    throw new Error("Awarded amount must be a non-negative number");
  }

  dispute.resolution = {
    outcome: input.outcome,
    summary,
    awardedAmount: input.awardedAmount,
    resolvedBy,
    resolvedAt: nowIso(),
    enforced: false,
  };
  dispute.status = "resolved";

  appendTimeline(
    dispute,
    "resolved",
    resolvedBy,
    `Dispute resolved: ${input.outcome}`,
    { outcome: input.outcome, awardedAmount: input.awardedAmount },
  );

  touch(dispute);
  return saveDispute(dispute);
}

export interface EnforceResolutionInput {
  disputeId: string;
  enforcedBy: string;
}

export function enforceResolution(
  input: EnforceResolutionInput,
): DisputeRecord {
  const dispute = getDisputeById(input.disputeId);
  if (!dispute) throw new Error("Dispute not found");
  if (dispute.status !== "resolved" || !dispute.resolution) {
    throw new Error("Cannot enforce a dispute before it is resolved");
  }
  if (dispute.resolution.enforced) {
    throw new Error("Resolution has already been enforced");
  }

  const enforcedBy = input.enforcedBy?.trim();
  if (!enforcedBy) throw new Error("Enforcer address is required");

  const enforcedAt = nowIso();
  dispute.resolution.enforced = true;
  dispute.resolution.enforcedAt = enforcedAt;
  dispute.resolution.enforcedBy = enforcedBy;
  dispute.status = "enforced";

  appendTimeline(
    dispute,
    "enforced",
    enforcedBy,
    "Resolution enforced",
    { outcome: dispute.resolution.outcome },
  );

  touch(dispute);
  return saveDispute(dispute);
}

export function getDisputeTimeline(disputeId: string): DisputeTimelineEvent[] {
  const dispute = getDisputeById(disputeId);
  return dispute ? [...dispute.timeline] : [];
}

export function getDisputeEvidence(disputeId: string): DisputeEvidence[] {
  const dispute = getDisputeById(disputeId);
  return dispute ? [...dispute.evidence] : [];
}

export function getDisputeVotes(disputeId: string): ArbitratorVote[] {
  const dispute = getDisputeById(disputeId);
  return dispute ? [...dispute.votes] : [];
}

export function isDisputeActive(dispute: DisputeRecord): boolean {
  return dispute.status !== "resolved" && dispute.status !== "enforced";
}