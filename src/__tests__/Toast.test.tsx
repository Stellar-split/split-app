import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Toast from '@/components/Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the message', () => {
    render(<Toast message="Saved!" />);
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('has role=alert', () => {
    render(<Toast message="Saved!" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders dismiss button when onDismiss provided', () => {
    render(<Toast message="Saved!" onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button clicked', async () => {
    const onDismiss = vi.fn();
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

  it('renders progress bar when duration is provided', () => {
    const { container } = render(
      <Toast message="Loading..." duration={4000} />
    );
    const progressBar = container.querySelector('div[aria-hidden="true"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('does not render progress bar when duration is not provided', () => {
    const { container } = render(<Toast message="Loading..." />);
    const progressBars = container.querySelectorAll('div[aria-hidden="true"]');
    expect(progressBars.length).toBe(0);
  });

  it('progress bar decreases over time', () => {
    const { container } = render(
      <Toast message="Loading..." duration={4000} />
    );
    const progressBar = container.querySelector('div[aria-hidden="true"]');
    const initialWidth = progressBar?.parentElement?.querySelector('div')?.style.width;

    vi.advanceTimersByTime(2000);

    const updatedWidth = progressBar?.parentElement?.querySelector('div')?.style.width;
    expect(initialWidth).not.toBe(updatedWidth);
  });

  it('pauses progress when hovering', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Toast message="Loading..." duration={4000} onDismiss={onDismiss} />
    );
    const alert = screen.getByRole('alert');

    userEvent.hover(alert);
    vi.advanceTimersByTime(2000);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('resumes progress when hover ends', async () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Toast message="Loading..." duration={1000} onDismiss={onDismiss} />
    );
    const alert = screen.getByRole('alert');

    await userEvent.hover(alert);
    vi.advanceTimersByTime(500);
    await userEvent.unhover(alert);
    vi.advanceTimersByTime(1000);

    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when progress completes', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Loading..." duration={1000} onDismiss={onDismiss} />);

    vi.advanceTimersByTime(1000);

    expect(onDismiss).toHaveBeenCalled();
  });
});
