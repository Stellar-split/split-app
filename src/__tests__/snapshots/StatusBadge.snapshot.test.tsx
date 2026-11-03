import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StatusBadge from '@/components/StatusBadge';

describe('StatusBadge snapshots', () => {
  it('renders the default (md) size', () => {
    const { container } = render(<StatusBadge status="Pending" />);
    expect(container.innerHTML).toBeTruthy();
  });

  it('renders the sm size', () => {
    const { container } = render(<StatusBadge status="Funded" size="sm" />);
    expect(container.innerHTML).toBeTruthy();
  });

  it('renders the lg size with a custom description', () => {
    const { container } = render(<StatusBadge status="Released" size="lg" description="Test" />);
    expect(container.innerHTML).toBeTruthy();
  });
});
