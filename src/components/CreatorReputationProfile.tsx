import React, { useState } from 'react';
import { useCreatorReputation } from '../hooks/useCreatorReputation';
import CreatorBadges from './CreatorBadges';
import ReputationAppealForm from './ReputationAppealForm';

export interface CreatorReputationProfileProps {
  address: string;
  className?: string;
}

interface ReputationBreakdown {
  onTimeRate?: number;
  completionRate?: number;
  disputeRate?: number;
  responsiveness?: number;
}

interface CreatorReputation {
  score?: number;
  grade?: string;
  trustTier?: string;
  breakdown?: ReputationBreakdown;
  badges?: string[];
  rated?: boolean;
}

const formatPercent = (value?: number): string => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '—';
  }
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#65a30d';
  if (score >= 40) return '#d97706';
  return '#dc2626';
};

const ScoreGauge: React.FC<{ score: number; grade?: string }> = ({ score, grade }) => {
  const clamped = Math.max(0, Math.min(100, score));
  const color = getScoreColor(clamped);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="creator-reputation-gauge" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={`Reputation score ${clamped} out of 100`}>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 64 64)"
        />
        <text x="64" y="60" textAnchor="middle" fontSize="28" fontWeight="700" fill="#111827">
          {Math.round(clamped)}
        </text>
        <text x="64" y="82" textAnchor="middle" fontSize="12" fill="#6b7280">
          / 100
        </text>
      </svg>
      <div className="creator-reputation-grade">
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Grade</div>
        <div style={{ fontSize: '2rem', fontWeight: 700, color }}>{grade ?? '—'}</div>
      </div>
    </div>
  );
};

const BreakdownRow: React.FC<{ label: string; value?: number; invert?: boolean }> = ({
  label,
  value,
  invert = false,
}) => {
  const normalized = value === undefined || value === null ? undefined : value <= 1 ? value * 100 : value;
  const barColor = invert
    ? normalized !== undefined && normalized > 20
      ? '#dc2626'
      : '#16a34a'
    : normalized !== undefined && normalized >= 80
    ? '#16a34a'
    : normalized !== undefined && normalized >= 50
    ? '#d97706'
    : '#dc2626';

  return (
    <div className="creator-reputation-breakdown-row" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#374151' }}>{label}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{formatPercent(value)}</span>
      </div>
      <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${normalized !== undefined ? Math.max(0, Math.min(100, normalized)) : 0}%`,
            background: barColor,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
};

const CreatorReputationProfile: React.FC<CreatorReputationProfileProps> = ({ address, className }) => {
  const { reputation, isLoading, error } = useCreatorReputation(address) as {
    reputation: CreatorReputation | null | undefined;
    isLoading: boolean;
    error?: Error | null;
  };
  const [isAppealOpen, setIsAppealOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={`creator-reputation-profile ${className ?? ''}`} aria-busy="true">
        <div className="creator-reputation-loading" style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
          Loading reputation…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`creator-reputation-profile ${className ?? ''}`} role="alert">
        <div className="creator-reputation-error" style={{ padding: '1.5rem', color: '#dc2626' }}>
          Unable to load reputation for this creator.
        </div>
      </div>
    );
  }

  const isUnrated =
    !reputation ||
    reputation.rated === false ||
    reputation.score === undefined ||
    reputation.score === null;

  if (isUnrated) {
    return (
      <div className={`creator-reputation-profile ${className ?? ''}`}>
        <div className="creator-reputation-unrated" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#111827' }}>Not yet rated</h3>
          <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            This creator has not accumulated enough activity to establish a reputation score.
          </p>
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#9ca3af', wordBreak: 'break-all' }}>
            {address}
          </div>
        </div>
      </div>
    );
  }

  const breakdown = reputation.breakdown ?? {};

  return (
    <div className={`creator-reputation-profile ${className ?? ''}`}>
      <div className="creator-reputation-header" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>Creator Reputation</h2>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', wordBreak: 'break-all' }}>{address}</div>
      </div>

      <div className="creator-reputation-score" style={{ marginBottom: '1.5rem' }}>
        <ScoreGauge score={reputation.score ?? 0} grade={reputation.grade} />
      </div>

      <div className="creator-reputation-trust" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.25rem' }}>
          Trust Tier
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.75rem' }}>
          {reputation.trustTier ?? 'Unranked'}
        </div>
        <CreatorBadges badges={reputation.badges ?? []} />
      </div>

      <div className="creator-reputation-breakdown" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#111827' }}>Breakdown</h3>
        <BreakdownRow label="On-time payment rate" value={breakdown.onTimeRate} />
        <BreakdownRow label="Completion rate" value={breakdown.completionRate} />
        <BreakdownRow label="Dispute rate" value={breakdown.disputeRate} invert />
        <BreakdownRow label="Responsiveness" value={breakdown.responsiveness} />
      </div>

      <div className="creator-reputation-actions">
        <button
          type="button"
          className="creator-reputation-appeal-button"
          onClick={() => setIsAppealOpen(true)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: '1px solid #d1d5db',
            background: '#ffffff',
            color: '#374151',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Dispute this score
        </button>
      </div>

      {isAppealOpen && (
        <ReputationAppealForm
          address={address}
          currentScore={reputation.score}
          onClose={() => setIsAppealOpen(false)}
        />
      )}
    </div>
  );
};

export default CreatorReputationProfile;