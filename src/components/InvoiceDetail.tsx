import React, { useCallback, useMemo, useState } from 'react';

/**
 * Invoice impact storytelling UI.
 *
 * Renders a narrative breakdown of how an invoice's amount translates into
 * real-world impact, with a mobile-responsive layout and accessible markup.
 */

export interface InvoiceImpactStory {
  /** Short headline describing the overall impact. */
  headline: string;
  /** One or two sentence narrative summary. */
  summary: string;
  /** Individual impact metrics that make up the story. */
  metrics: InvoiceImpactMetric[];
}

export interface InvoiceImpactMetric {
  /** Stable identifier for the metric. */
  id: string;
  /** Human readable label, e.g. "Meals provided". */
  label: string;
  /** Numeric value for the metric. */
  value: number;
  /** Optional unit suffix, e.g. "meals", "hours". */
  unit?: string;
  /** Optional emoji or short glyph used as a visual marker. */
  icon?: string;
}

export type MilestoneConditionStatus = 'pending' | 'approved' | 'verified';

export interface MilestoneEvidence {
  /** Stable identifier for the uploaded evidence. */
  id: string;
  /** Display name of the uploaded file. */
  name: string;
  /** IPFS URI (e.g. ipfs://...) returned by the upload helper. */
  uri: string;
  /** Optional MIME type of the uploaded file. */
  mimeType?: string;
  /** ISO timestamp of when the evidence was uploaded. */
  uploadedAt: string;
}

export interface MilestoneCondition {
  /** Stable identifier for the condition. */
  id: string;
  /** Human readable description of the condition. */
  description: string;
  /** Current status of the condition. */
  status: MilestoneConditionStatus;
}

export interface Milestone {
  /** Stable identifier for the milestone. */
  id: string;
  /** Short title for the milestone. */
  title: string;
  /** Deliverable text describing what must be produced. */
  deliverable: string;
  /** Amount (smallest currency unit) released when conditions are met. */
  amount: number;
  /** Whether an explicit approval is required before release. */
  requiresApproval: boolean;
  /** Whether evidence/documentation must be uploaded before release. */
  requiresEvidence: boolean;
  /** Conditions that must be satisfied before funds are released. */
  conditions: MilestoneCondition[];
  /** Uploaded evidence documents. */
  evidence: MilestoneEvidence[];
}

export interface MilestoneDraft {
  title: string;
  deliverable: string;
  amount: number;
  requiresApproval: boolean;
  requiresEvidence: boolean;
}

export interface ReleaseResult {
  success: boolean;
  message?: string;
}

export interface InvoiceDetailProps {
  /** Invoice identifier shown in the header. */
  invoiceId: string;
  /** Total invoice amount in the smallest currency unit (e.g. cents). */
  amount: number;
  /** ISO 4217 currency code. Defaults to USD. */
  currency?: string;
  /** Optional pre-computed impact story. */
  story?: InvoiceImpactStory;
  /** Optional loading flag while the story is being fetched. */
  loading?: boolean;
  /** Optional error message to surface instead of the story. */
  error?: string | null;
  /** Optional initial milestones for the invoice. */
  initialMilestones?: Milestone[];
  /** Uploads evidence to IPFS and resolves with the resulting URI. */
  uploadEvidence?: (file: File) => Promise<string>;
  /** Releases funds for a milestone once all conditions are satisfied. */
  releaseMilestone?: (
    invoiceId: string,
    milestone: Milestone,
  ) => Promise<ReleaseResult>;
  /** Notification callback for user-facing events. */
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const DEFAULT_CURRENCY = 'USD';
const XLM_CURRENCY = 'XLM';
const RATE_DECIMALS = 6;

function formatXlmAmount(amount: number, rate: number): string {
  const converted = (Math.max(0, amount) / 100) * rate;
  return `${converted.toFixed(RATE_DECIMALS)} ${XLM_CURRENCY}`;
}

function formatRate(rate: number): string {
  return `1 ${XLM_CURRENCY} = ${(1 / rate).toFixed(RATE_DECIMALS)}`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

function formatMetricValue(metric: InvoiceImpactMetric): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(metric.value);
  return metric.unit ? `${formatted} ${metric.unit}` : formatted;
}

/**
 * Derives a default impact story from the invoice amount when no story is
 * supplied. Keeps the UI useful even before a backend narrative is available.
 */
export function deriveImpactStory(amount: number): InvoiceImpactStory {
  const dollars = Math.max(0, amount) / 100;
  return {
    headline: 'Your invoice is making an impact',
    summary:
      'Every invoice you pay is converted into measurable outcomes. Here is how this one breaks down.',
    metrics: [
      {
        id: 'meals',
        label: 'Meals provided',
        value: Math.round(dollars * 4),
        unit: 'meals',
        icon: '\u{1F37D}\u{FE0F}',
      },
      {
        id: 'hours',
        label: 'Support hours funded',
        value: Math.round(dollars * 0.5 * 10) / 10,
        unit: 'hours',
        icon: '\u{23F1}\u{FE0F}',
      },
      {
        id: 'trees',
        label: 'Trees planted',
        value: Math.round(dollars * 0.2),
        unit: 'trees',
        icon: '\u{1F333}',
      },
    ],
  };
}

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildConditions(draft: MilestoneDraft): MilestoneCondition[] {
  const conditions: MilestoneCondition[] = [
    {
      id: createId('condition'),
      description: `Deliverable completed: ${draft.deliverable.trim()}`,
      status: 'pending',
    },
  ];
  if (draft.requiresApproval) {
    conditions.push({
      id: createId('condition'),
      description: 'Recipient approval obtained',
      status: 'pending',
    });
  }
  if (draft.requiresEvidence) {
    conditions.push({
      id: createId('condition'),
      description: 'Evidence/documentation uploaded and verified',
      status: 'pending',
    });
  }
  return conditions;
}

export function areConditionsSatisfied(milestone: Milestone): boolean {
  if (milestone.conditions.length === 0) {
    return false;
  }
  if (!milestone.conditions.every((c) => c.status === 'verified')) {
    return false;
  }
  if (milestone.requiresEvidence && milestone.evidence.length === 0) {
    return false;
  }
  return true;
}

const EMPTY_DRAFT: MilestoneDraft = {
  title: '',
  deliverable: '',
  amount: 0,
  requiresApproval: true,
  requiresEvidence: true,
};

const InvoiceDetail: React.FC<InvoiceDetailProps> = ({
  invoiceId,
  amount,
  currency = DEFAULT_CURRENCY,
  story,
  loading = false,
  error = null,
  initialMilestones,
  uploadEvidence,
  releaseMilestone,
  onNotify,
}) => {
  const [milestones, setMilestones] = useState<Milestone[]>(
    () => initialMilestones ?? [],
  );
  const [draft, setDraft] = useState<MilestoneDraft>(EMPTY_DRAFT);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [releasingFor, setReleasingFor] = useState<string | null>(null);

  const notify = useCallback(
    (message: string, type: 'success' | 'error' | 'info') => {
      onNotify?.(message, type);
    },
    [onNotify],
  );

  const updateMilestone = useCallback(
    (milestoneId: string, updater: (m: Milestone) => Milestone) => {
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? updater(m) : m)),
      );
    },
    [],
  );

  const handleDraftChange = useCallback(
    <K extends keyof MilestoneDraft>(key: K, value: MilestoneDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleAddMilestone = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!draft.title.trim()) {
        setDraftError('Milestone title is required.');
        return;
      }
      if (!draft.deliverable.trim()) {
        setDraftError('Deliverable description is required.');
        return;
      }
      if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
        setDraftError('Milestone amount must be greater than zero.');
        return;
      }
      const milestone: Milestone = {
        id: createId('milestone'),
        title: draft.title.trim(),
        deliverable: draft.deliverable.trim(),
        amount: draft.amount,
        requiresApproval: draft.requiresApproval,
        requiresEvidence: draft.requiresEvidence,
        conditions: buildConditions(draft),
        evidence: [],
      };
      setMilestones((prev) => [...prev, milestone]);
      setDraft(EMPTY_DRAFT);
      setDraftError(null);
      notify(`Milestone "${milestone.title}" added.`, 'success');
    },
    [draft, notify],
  );

  const handleRemoveMilestone = useCallback(
    (milestoneId: string) => {
      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      notify('Milestone removed.', 'info');
    },
    [notify],
  );

  const handleApproveCondition = useCallback(
    (milestoneId: string, conditionId: string) => {
      updateMilestone(milestoneId, (m) => ({
        ...m,
        conditions: m.conditions.map((c) =>
          c.id === conditionId && c.status === 'pending'
            ? { ...c, status: 'approved' }
            : c,
        ),
      }));
      notify('Condition approved.', 'success');
    },
    [updateMilestone, notify],
  );

  const handleVerifyCondition = useCallback(
    (milestoneId: string, conditionId: string) => {
      updateMilestone(milestoneId, (m) => ({
        ...m,
        conditions: m.conditions.map((c) =>
          c.id === conditionId && c.status === 'approved'
            ? { ...c, status: 'verified' }
            : c,
        ),
      }));
      notify('Condition verified.', 'success');
    },
    [updateMilestone, notify],
  );

  const handleEvidenceUpload = useCallback(
    async (milestoneId: string, file: File) => {
      if (!uploadEvidence) {
        notify('Evidence upload is not configured.', 'error');
        return;
      }
      setUploadingFor(milestoneId);
      try {
        const uri = await uploadEvidence(file);
        const evidence: MilestoneEvidence = {
          id: createId('evidence'),
          name: file.name,
          uri,
          mimeType: file.type || undefined,
          uploadedAt: new Date().toISOString(),
        };
        updateMilestone(milestoneId, (m) => ({
          ...m,
          evidence: [...m.evidence, evidence],
        }));
        notify(`Evidence "${file.name}" uploaded.`, 'success');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Evidence upload failed.';
        notify(message, 'error');
      } finally {
        setUploadingFor(null);
      }
    },
    [uploadEvidence, updateMilestone, notify],
  );

  const handleRelease = useCallback(
    async (milestone: Milestone) => {
      if (!areConditionsSatisfied(milestone)) {
        notify('All conditions must be satisfied before release.', 'error');
        return;
      }
      if (!releaseMilestone) {
        notify('Fund release is not configured.', 'error');
        return;
      }
      setReleasingFor(milestone.id);
      try {
        const result = await releaseMilestone(invoiceId, milestone);
        if (result.success) {
          notify(
            result.message ?? `Funds released for "${milestone.title}".`,
            'success',
          );
        } else {
          notify(result.message ?? 'Fund release failed.', 'error');
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Fund release failed.';
        notify(message, 'error');
      } finally {
        setReleasingFor(null);
      }
    },
    [invoiceId, releaseMilestone, notify],
  );
  const resolvedStory = useMemo(
    () => story ?? deriveImpactStory(amount),
    [story, amount],
  );

  const formattedAmount = useMemo(
    () => formatCurrency(amount, currency),
    [amount, currency],
  );

  const effectiveRate = lockedRate ?? xlmRate;
  const isRateLocked = lockedRate !== null && lockedRate !== undefined;

  const convertedAmount = useMemo(() => {
    if (effectiveRate === null || effectiveRate === undefined) {
      return null;
    }
    return formatXlmAmount(amount, effectiveRate);
  }, [amount, effectiveRate]);

  const historyForCurrency = useMemo(
    () => currencyHistory.filter((snapshot) => snapshot.currency === currency),
    [currencyHistory, currency],
  );

  return (
    <section
      className="invoice-detail"
      aria-labelledby={`invoice-detail-heading-${invoiceId}`}
    >
      <header className="invoice-detail__header">
        <p className="invoice-detail__eyebrow">Invoice {invoiceId}</p>
        <h2
          id={`invoice-detail-heading-${invoiceId}`}
          className="invoice-detail__amount"
        >
          {formattedAmount}
        </h2>
        <p className="invoice-detail__currency">Currency: {currency}</p>

        <div className="invoice-detail__conversion" aria-live="polite">
          {rateLoading ? (
            <span className="invoice-detail__status" role="status">
              Loading exchange rate\u2026
            </span>
          ) : rateError ? (
            <span
              className="invoice-detail__status invoice-detail__status--error"
              role="alert"
            >
              {rateError}
            </span>
          ) : convertedAmount ? (
            <>
              <span className="invoice-detail__converted-amount">
                \u2248 {convertedAmount}
              </span>
              {effectiveRate !== null && effectiveRate !== undefined ? (
                <span className="invoice-detail__rate">
                  {formatRate(effectiveRate)}
                </span>
              ) : null}
              {isRateLocked ? (
                <span className="invoice-detail__rate-lock">
                  Rate locked
                  {rateLockedUntil
                    ? ` until ${formatTimestamp(rateLockedUntil)}`
                    : ''}
                </span>
              ) : null}
            </>
          ) : (
            <span className="invoice-detail__status">
              XLM conversion unavailable
            </span>
          )}
        </div>
      </header>

      {loading ? (
        <div
          className="invoice-detail__status"
          role="status"
          aria-live="polite"
        >
          Loading impact story\u2026
        </div>
      ) : error ? (
        <div className="invoice-detail__status invoice-detail__status--error" role="alert">
          {error}
        </div>
      ) : (
        <div className="invoice-detail__story">
          <h3 className="invoice-detail__headline">{resolvedStory.headline}</h3>
          <p className="invoice-detail__summary">{resolvedStory.summary}</p>

          <ul className="invoice-detail__metrics">
            {resolvedStory.metrics.map((metric) => (
              <li key={metric.id} className="invoice-detail__metric">
                {metric.icon ? (
                  <span
                    className="invoice-detail__metric-icon"
                    aria-hidden="true"
                  >
                    {metric.icon}
                  </span>
                ) : null}
                <span className="invoice-detail__metric-value">
                  {formatMetricValue(metric)}
                </span>
                <span className="invoice-detail__metric-label">
                  {metric.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section
        className="invoice-detail__milestones"
        aria-labelledby={`invoice-milestones-heading-${invoiceId}`}
      >
        <h3 id={`invoice-milestones-heading-${invoiceId}`}>
          Milestones &amp; conditions
        </h3>

        <form
          className="milestone-editor"
          onSubmit={handleAddMilestone}
          aria-label="Add milestone"
        >
          <div className="milestone-editor__field">
            <label htmlFor={`milestone-title-${invoiceId}`}>Title</label>
            <input
              id={`milestone-title-${invoiceId}`}
              type="text"
              value={draft.title}
              onChange={(e) => handleDraftChange('title', e.target.value)}
              required
            />
          </div>
          <div className="milestone-editor__field">
            <label htmlFor={`milestone-deliverable-${invoiceId}`}>
              Deliverable
            </label>
            <textarea
              id={`milestone-deliverable-${invoiceId}`}
              value={draft.deliverable}
              onChange={(e) =>
                handleDraftChange('deliverable', e.target.value)
              }
              required
            />
          </div>
          <div className="milestone-editor__field">
            <label htmlFor={`milestone-amount-${invoiceId}`}>
              Amount (in {currency})
            </label>
            <input
              id={`milestone-amount-${invoiceId}`}
              type="number"
              min={0}
              step="0.01"
              value={draft.amount === 0 ? '' : draft.amount / 100}
              onChange={(e) =>
                handleDraftChange(
                  'amount',
                  Math.round(Number(e.target.value) * 100),
                )
              }
              required
            />
          </div>
          <div className="milestone-editor__field milestone-editor__field--checkbox">
            <label>
              <input
                type="checkbox"
                checked={draft.requiresApproval}
                onChange={(e) =>
                  handleDraftChange('requiresApproval', e.target.checked)
                }
              />
              Requires approval
            </label>
          </div>
          <div className="milestone-editor__field milestone-editor__field--checkbox">
            <label>
              <input
                type="checkbox"
                checked={draft.requiresEvidence}
                onChange={(e) =>
                  handleDraftChange('requiresEvidence', e.target.checked)
                }
              />
              Requires evidence
            </label>
          </div>
          {draftError ? (
            <p className="milestone-editor__error" role="alert">
              {draftError}
            </p>
          ) : null}
          <button type="submit" className="milestone-editor__submit">
            Add milestone
          </button>
        </form>

        {milestones.length === 0 ? (
          <p className="invoice-detail__milestones-empty">
            No milestones defined yet.
          </p>
        ) : (
          <ul className="milestone-list">
            {milestones.map((milestone) => {
              const satisfied = areConditionsSatisfied(milestone);
              return (
                <li key={milestone.id} className="milestone-list__item">
                  <header className="milestone-list__header">
                    <h4 className="milestone-list__title">{milestone.title}</h4>
                    <span className="milestone-list__amount">
                      {formatCurrency(milestone.amount, currency)}
                    </span>
                  </header>
                  <p className="milestone-list__deliverable">
                    {milestone.deliverable}
                  </p>

                  <ul className="milestone-list__conditions">
                    {milestone.conditions.map((condition) => (
                      <li
                        key={condition.id}
                        className={`milestone-condition milestone-condition--${condition.status}`}
                      >
                        <span className="milestone-condition__description">
                          {condition.description}
                        </span>
                        <span
                          className="milestone-condition__status"
                          aria-label={`Status: ${condition.status}`}
                        >
                          {condition.status}
                        </span>
                        {condition.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleApproveCondition(
                                milestone.id,
                                condition.id,
                              )
                            }
                          >
                            Approve
                          </button>
                        ) : null}
                        {condition.status === 'approved' ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleVerifyCondition(
                                milestone.id,
                                condition.id,
                              )
                            }
                          >
                            Verify
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {milestone.requiresEvidence ? (
                    <div className="milestone-list__evidence">
                      <label
                        htmlFor={`milestone-evidence-${milestone.id}`}
                      >
                        Upload evidence
                      </label>
                      <input
                        id={`milestone-evidence-${milestone.id}`}
                        type="file"
                        disabled={uploadingFor === milestone.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleEvidenceUpload(milestone.id, file);
                          }
                          e.target.value = '';
                        }}
                      />
                      {uploadingFor === milestone.id ? (
                        <span role="status">Uploading\u2026</span>
                      ) : null}
                      {milestone.evidence.length > 0 ? (
                        <ul className="milestone-list__evidence-items">
                          {milestone.evidence.map((ev) => (
                            <li key={ev.id}>
                              <a
                                href={ev.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {ev.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="milestone-list__actions">
                    <button
                      type="button"
                      className="milestone-list__release"
                      disabled={!satisfied || releasingFor === milestone.id}
                      aria-disabled={!satisfied || releasingFor === milestone.id}
                      title={
                        satisfied
                          ? 'Release funds'
                          : 'All conditions must be satisfied before release'
                      }
                      onClick={() => void handleRelease(milestone)}
                    >
                      {releasingFor === milestone.id
                        ? 'Releasing\u2026'
                        : 'Release funds'}
                    </button>
                    <button
                      type="button"
                      className="milestone-list__remove"
                      onClick={() => handleRemoveMilestone(milestone.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
};

export default InvoiceDetail;
