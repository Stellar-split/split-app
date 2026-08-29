import { describe, it, expect } from 'vitest';
import { isValidTransition } from './invoiceStateMachine';

describe('Invoice State Machine', () => {
  it('allows valid transitions', () => {
    expect(isValidTransition('Draft', 'Pending')).toBe(true);
    expect(isValidTransition('Pending', 'Fully Paid')).toBe(true);
    expect(isValidTransition('Partially Paid', 'Fully Paid')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(isValidTransition('Draft', 'Fully Paid')).toBe(false);
    expect(isValidTransition('Fully Paid', 'Draft')).toBe(false);
  });
});
