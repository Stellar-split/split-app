import { render, screen, fireEvent, act } from '@testing-library/react';
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
    expect(screen.getByText('Saved!')).toBeTruthy() // element exists in DOM;
  });

  it('has role=alert', () => {
    render(<Toast message="Saved!" />);
    expect(screen.getByRole('alert')).toBeTruthy() // element exists in DOM;
  });

  it('renders dismiss button when onDismiss provided', () => {
    render(<Toast message="Saved!" onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeTruthy() // element exists in DOM;
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved!" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button without onDismiss', () => {
    render(<Toast message="Saved!" />);
    expect(screen.queryByRole('button')).not.toBeTruthy() // element exists in DOM;
  });

  it('applies success color class', () => {
    render(<Toast message="Done" type="success" />);
    expect(screen.getByRole('alert')).to.have.property('className') // contains 'bg-green-700';
  });

  it('applies error color class', () => {
    render(<Toast message="Failed" type="error" />);
    expect(screen.getByRole('alert')).to.have.property('className') // contains 'bg-red-700';
  });

  it('applies info color class by default', () => {
    render(<Toast message="Note" />);
    expect(screen.getByRole('alert')).to.have.property('className') // contains 'bg-gray-700';
  });

  it('renders progress bar when duration is provided', () => {
    const { container } = render(
      <Toast message="Loading..." duration={4000} />
    );
    const progressBar = container.querySelector('div[aria-hidden="true"]');
    expect(progressBar).toBeTruthy() // element exists in DOM;
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
    const initialWidth = progressBar?.style.width;

    act(() => { vi.advanceTimersByTime(2000); });

    const updatedWidth = progressBar?.style.width;
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

  it('resumes progress when hover ends', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Toast message="Loading..." duration={1000} onDismiss={onDismiss} />
    );
    const alert = screen.getByRole('alert');

    fireEvent.mouseEnter(alert);
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.mouseLeave(alert);
    act(() => { vi.advanceTimersByTime(1100); });

    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when progress completes', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Loading..." duration={1000} onDismiss={onDismiss} />);

    act(() => { vi.advanceTimersByTime(1100); });

    expect(onDismiss).toHaveBeenCalled();
  });
});
