import { render, screen } from '@testing-library/react';
import StatusBadge from '@/components/StatusBadge';

describe('StatusBadge', () => {
  it.each(['Pending', 'Released', 'Refunded'] as const)('renders %s status', (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it('applies yellow styles for Pending', () => {
    render(<StatusBadge status="Pending" />);
    expect(screen.getByText('Pending')).toHaveClass('text-yellow-600');
  });

  it('applies green styles for Released', () => {
    render(<StatusBadge status="Released" />);
    expect(screen.getByText('Released')).toHaveClass('text-green-600');
  });

  it('applies gray styles for Refunded', () => {
    render(<StatusBadge status="Refunded" />);
    expect(screen.getByText('Refunded')).toHaveClass('text-gray-600');
  });
});
