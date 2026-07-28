import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '@/components/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('shows spinner and disables when loading', () => {
    render(<Button loading>Click me</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies primary variant classes by default', () => {
    render(<Button>Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-brand-600');
  });

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-surface-800');
  });
});
