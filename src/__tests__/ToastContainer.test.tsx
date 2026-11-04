import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ToastContainer from '@/components/ToastContainer';

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders no toasts when none are added', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('deduplicates identical toasts fired in rapid succession', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    act(() => {
      addToast('Saved!', 'success');
      addToast('Saved!', 'success');
      addToast('Saved!', 'success');
    });

    const toastMessages = screen.getAllByText('Saved!');
    expect(toastMessages).toHaveLength(1);
  });

  it('does not deduplicate toasts with different messages', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    act(() => {
      addToast('Saved!', 'success');
      addToast('Error!', 'error');
    });

    expect(screen.getByText('Saved!')).toBeTruthy() // element exists in DOM;
    expect(screen.getByText('Error!')).toBeTruthy() // element exists in DOM;
  });

  it('does not deduplicate toasts with different types', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    act(() => {
      addToast('Updated', 'success');
      addToast('Updated', 'error');
    });

    const toastMessages = screen.getAllByText('Updated');
    expect(toastMessages).toHaveLength(2);
  });

  it('resets auto-dismiss timer when duplicate toast is added', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    act(() => { addToast('Saving...', 'info'); });
    expect(screen.getByText('Saving...')).toBeTruthy() // element exists in DOM;

    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText('Saving...')).toBeTruthy() // element exists in DOM;

    act(() => { addToast('Saving...', 'info'); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText('Saving...')).toBeTruthy() // element exists in DOM;

    act(() => { vi.advanceTimersByTime(1001); });
    expect(screen.queryByText('Saving...')).not.toBeTruthy() // element exists in DOM;
  });

  it('auto-dismisses toasts after 5 seconds', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    act(() => { addToast('Processed', 'success'); });
    expect(screen.getByText('Processed')).toBeTruthy() // element exists in DOM;

    act(() => { vi.advanceTimersByTime(5001); });
    expect(screen.queryByText('Processed')).not.toBeTruthy() // element exists in DOM;
  });
});
