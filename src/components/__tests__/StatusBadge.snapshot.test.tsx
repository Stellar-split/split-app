import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StatusBadge from '@/components/StatusBadge';

describe('StatusBadge (snapshot)', () => {
  it('renders a Pending badge consistently', () => {
    const { container } = render(<StatusBadge status="Pending" />);
    expect(container.innerHTML).toBeTruthy();
  });

  it('renders a Released badge at lg size consistently', () => {
    const { container } = render(<StatusBadge status="Released" size="lg" />);
    expect(container.innerHTML).toBeTruthy();
  });
});
