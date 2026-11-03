import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getHelpEntry } from '../lib/helpContent';
import { trackHelpEvent } from '../lib/helpAnalytics';

export interface HelpTooltipProps {
  /** Key into the help content registry. */
  helpKey: string;
  /** Optional override for the accessible label of the trigger button. */
  label?: string;
  /** Optional placement of the tooltip relative to the trigger. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional additional class names for the wrapper. */
  className?: string;
}

const PLACEMENT_STYLES: Record<NonNullable<HelpTooltipProps['placement']>, React.CSSProperties> = {
  top: { bottom: '100%', left: '50%', transform: 'translate(-50%, -8px)' },
  bottom: { top: '100%', left: '50%', transform: 'translate(-50%, 8px)' },
  left: { right: '100%', top: '50%', transform: 'translate(-8px, -50%)' },
  right: { left: '100%', top: '50%', transform: 'translate(8px, -50%)' },
};

/**
 * A focusable help icon button that reveals contextual help text.
 *
 * Accessibility:
 * - The trigger is a real <button> so it is keyboard focusable and activatable.
 * - The tooltip element is referenced via aria-describedby so screen readers
 *   announce the help text when the trigger receives focus.
 * - Escape dismisses the tooltip and returns focus to the trigger.
 * - The tooltip uses role="tooltip" and is hidden from the accessibility tree
 *   when not visible.
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  helpKey,
  label,
  placement = 'top',
  className,
}) => {
  const entry = getHelpEntry(helpKey);
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    setOpen(true);
    trackHelpEvent('help_opened', { helpKey });
  }, [helpKey]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  const handleClick = useCallback(() => {
    if (open) {
      hide();
    } else {
      show();
    }
  }, [open, show, hide]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        hide();
        triggerRef.current?.focus();
      }
    },
    [open, hide],
  );

  // Dismiss on outside click / focus loss.
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (triggerRef.current && target && !triggerRef.current.contains(target)) {
        hide();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open, hide]);

  if (!entry) {
    // Fail safe: render nothing if the help key is unknown.
    return null;
  }

  const accessibleLabel = label ?? `Help: ${entry.title}`;

  return (
    <span
      className={['help-tooltip', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="help-tooltip__trigger"
        aria-label={accessibleLabel}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={show}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.25rem',
          height: '1.25rem',
          padding: 0,
          border: '1px solid currentColor',
          borderRadius: '50%',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: '0.75rem',
          lineHeight: 1,
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="help-tooltip__content"
          style={{
            position: 'absolute',
            zIndex: 1000,
            minWidth: '12rem',
            maxWidth: '20rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            background: '#1f2937',
            color: '#f9fafb',
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            ...PLACEMENT_STYLES[placement],
          }}
        >
          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{entry.title}</strong>
          <span>{entry.body}</span>
        </span>
      )}
    </span>
  );
};

export default HelpTooltip;
  /** Unique identifier used to look up the entry. */
  id: string;
  /** Short title shown in the tooltip header. */
  title: string;
  /** Body text providing contextual help. */
  body: string;
  /** Optional related documentation URL. */
  learnMoreUrl?: string;
}

/**
 * Registry of contextual help entries keyed by id.
 *
 * Keys are stable identifiers referenced by HelpTooltip and contextual help
 * components throughout the app. Add new entries here so they can be reused.
 */
export const helpContent: Record<string, HelpEntry> = {
  'dashboard.overview': {
    id: 'dashboard.overview',
    title: 'Dashboard overview',
    body: 'This dashboard summarizes your key metrics. Use the filters above to narrow the data shown.',
  },
  'dashboard.metrics': {
    id: 'dashboard.metrics',
    title: 'Metrics',
    body: 'Metrics are refreshed every few minutes. Hover over a chart to see detailed values for a point in time.',
  },
  'navigation.breadcrumbs': {
    id: 'navigation.breadcrumbs',
    title: 'Breadcrumbs',
    body: 'Breadcrumbs show where you are in the app and let you jump back to any parent page.',
  },
  'search.input': {
    id: 'search.input',
    title: 'Search',
    body: 'Search across records by name, id, or tag. Press Enter to run the search or Escape to clear it.',
  },
  'settings.notifications': {
    id: 'settings.notifications',
    title: 'Notifications',
    body: 'Choose which events trigger notifications and how you would like to receive them.',
  },
  'settings.privacy': {
    id: 'settings.privacy',
    title: 'Privacy',
    body: 'Control how your data is stored and shared. Changes take effect immediately.',
  },
  'forms.required': {
    id: 'forms.required',
    title: 'Required fields',
    body: 'Fields marked with an asterisk are required and must be completed before saving.',
  },
  'reports.export': {
    id: 'reports.export',
    title: 'Export reports',
    body: 'Export the current report as CSV or PDF. Large reports may take a moment to generate.',
  },
};

/**
 * Look up a help entry by id.
 * Returns undefined when the key is unknown so callers can fail gracefully.
 */
export function getHelpEntry(id: string): HelpEntry | undefined {
  return helpContent[id];
}

/**
 * List all registered help entries.
 */
export function listHelpEntries(): HelpEntry[] {
  return Object.values(helpContent);
}

export default helpContent;
```

```ts
/**
 * Lightweight help analytics helper.
 *
 * Emits help-related analytics events. The transport is intentionally pluggable
 * so the app can wire in its analytics provider (Segment, GA, custom, etc.)
 * without changing call sites.
 */

export type HelpEventName = 'help_opened' | 'help_closed' | 'help_link_clicked';

export interface HelpEventPayload {
  helpKey: string;
  [key: string]: unknown;
}

export type HelpEventTransport = (eventName: HelpEventName, payload: HelpEventPayload) => void;

let transport: HelpEventTransport | null = null;

/**
 * Register the analytics transport used to send help events.
 * Pass null to disable tracking.
 */
export function setHelpAnalyticsTransport(next: HelpEventTransport | null): void {
  transport = next;
}

/**
 * Track a help analytics event. Safe to call even when no transport is
 * registered (events are silently dropped).
 */
export function trackHelpEvent(eventName: HelpEventName, payload: HelpEventPayload): void {
  if (!transport) {
    return;
  }
  try {
    transport(eventName, payload);
  } catch {
    // Analytics must never break the UI.
  }
}