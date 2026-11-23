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