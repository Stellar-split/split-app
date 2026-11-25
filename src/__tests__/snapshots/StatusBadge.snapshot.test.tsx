import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StatusBadge from '@/components/StatusBadge';

describe('StatusBadge snapshots', () => {
  it('renders the default (md) size', () => {
    const { container } = render(<StatusBadge status="Pending" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders the sm size', () => {
    const { container } = render(<StatusBadge status="Funded" size="sm" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders the lg size with a custom description', () => {
    const { container } = render(<StatusBadge status="Released" size="lg" description="Test" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders every status variant consistently', () => {
    const statuses = ['Pending', 'Active', 'Funded', 'Released', 'Refunded', 'Disputed', 'Frozen', 'Archived', 'Expired', 'Cancelled'];
    for (const status of statuses) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      expect(container.firstChild).toMatchSnapshot();
      unmount();
    }
  });
});
