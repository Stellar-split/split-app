import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toast from '@/components/Toast';

describe('Toast', () => {
  it('renders the message', () => {
    render(<Toast message="Saved!" />);
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('has role=alert', () => {
    render(<Toast message="Saved!" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders dismiss button when onDismiss provided', () => {
    render(<Toast message="Saved!" onDismiss={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button clicked', async () => {
    const onDismiss = jest.fn();
    render(<Toast message="Saved!" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button without onDismiss', () => {
    render(<Toast message="Saved!" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies success color class', () => {
    render(<Toast message="Done" type="success" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-green-700');
  });

  it('applies error color class', () => {
    render(<Toast message="Failed" type="error" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-red-700');
  });

  it('applies info color class by default', () => {
    render(<Toast message="Note" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-gray-700');
  });
});
