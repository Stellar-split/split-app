import { render, screen, waitFor } from '@testing-library/react';
import ToastContainer from '@/components/ToastContainer';

describe('ToastContainer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders no toasts when none are added', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('deduplicates identical toasts fired in rapid succession', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    addToast('Saved!', 'success');
    addToast('Saved!', 'success');
    addToast('Saved!', 'success');

    const toastMessages = screen.getAllByText('Saved!');
    expect(toastMessages).toHaveLength(1);
  });

  it('does not deduplicate toasts with different messages', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    addToast('Saved!', 'success');
    addToast('Error!', 'error');

    expect(screen.getByText('Saved!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('does not deduplicate toasts with different types', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    addToast('Updated', 'success');
    addToast('Updated', 'error');

    const toastMessages = screen.getAllByText('Updated');
    expect(toastMessages).toHaveLength(2);
  });

  it('resets auto-dismiss timer when duplicate toast is added', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    addToast('Saving...', 'info');

    jest.advanceTimersByTime(4000);
    expect(screen.getByText('Saving...')).toBeInTheDocument();

    addToast('Saving...', 'info');
    jest.advanceTimersByTime(4000);
    expect(screen.getByText('Saving...')).toBeInTheDocument();

    jest.advanceTimersByTime(1000);
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
  });

  it('auto-dismisses toasts after 5 seconds', () => {
    render(<ToastContainer />);

    const addToast = (window as any).__toastContainer?.addToast;
    if (!addToast) throw new Error('addToast not exposed');

    addToast('Processed', 'success');
    expect(screen.getByText('Processed')).toBeInTheDocument();

    jest.advanceTimersByTime(5000);
    expect(screen.queryByText('Processed')).not.toBeInTheDocument();
  });
});
