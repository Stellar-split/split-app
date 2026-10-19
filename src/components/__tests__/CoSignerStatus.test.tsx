import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CoSignerStatus } from '../CoSignerStatus';

describe('CoSignerStatus', () => {
  const defaultProps = {
    coSigners: [
      { address: 'GAAAA1111', approved: false },
      { address: 'GBBBB2222', approved: true },
      { address: 'GCCCC3333', approved: false },
    ],
    threshold: 2,
    connectedAddress: null as string | null,
    onApprove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all co-signers with pending and approved states', () => {
    render(<CoSignerStatus {...defaultProps} />);

    expect(screen.getByText('GAAAA1111')).toBeInTheDocument();
    expect(screen.getByText('GBBBB2222')).toBeInTheDocument();
    expect(screen.getByText('GCCCC3333')).toBeInTheDocument();

    expect(screen.getAllByText(/pending/i)).toHaveLength(2);
    expect(screen.getAllByText(/approved/i)).toHaveLength(1);
  });

  it('does not show threshold-met indicator when approved count is below threshold', () => {
    render(<CoSignerStatus {...defaultProps} />);

    expect(screen.queryByText(/threshold met/i)).not.toBeInTheDocument();
  });

  it('shows threshold-met indicator when approved count meets threshold', () => {
    render(
      <CoSignerStatus
        {...defaultProps}
        coSigners={[
          { address: 'GAAAA1111', approved: true },
          { address: 'GBBBB2222', approved: true },
          { address: 'GCCCC3333', approved: false },
        ]}
      />
    );

    expect(screen.getByText(/threshold met/i)).toBeInTheDocument();
  });

  it('shows threshold-met indicator when approved count exceeds threshold', () => {
    render(
      <CoSignerStatus
        {...defaultProps}
        coSigners={[
          { address: 'GAAAA1111', approved: true },
          { address: 'GBBBB2222', approved: true },
          { address: 'GCCCC3333', approved: true },
        ]}
      />
    );

    expect(screen.getByText(/threshold met/i)).toBeInTheDocument();
  });

  it('enables Approve button when connected address matches a pending co-signer', () => {
    render(
      <CoSignerStatus
        {...defaultProps}
        connectedAddress="GAAAA1111"
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).toBeEnabled();
  });

  it('disables Approve button when wallet is not connected', () => {
    render(<CoSignerStatus {...defaultProps} connectedAddress={null} />);

    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).toBeDisabled();
  });

  it('disables Approve button when connected address is not a co-signer', () => {
    render(
      <CoSignerStatus
        {...defaultProps}
        connectedAddress="GZZZZ9999"
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).toBeDisabled();
  });

  it('disables Approve button when connected co-signer has already approved', () => {
    render(
      <CoSignerStatus
        {...defaultProps}
        connectedAddress="GBBBB2222"
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).toBeDisabled();
  });

  it('calls onApprove with the connected address when Approve is clicked', () => {
    const onApprove = jest.fn();
    render(
      <CoSignerStatus
        {...defaultProps}
        connectedAddress="GAAAA1111"
        onApprove={onApprove}
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    fireEvent.click(approveButton);

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith('GAAAA1111');
  });

  it('does not call onApprove when Approve button is disabled', () => {
    const onApprove = jest.fn();
    render(
      <CoSignerStatus
        {...defaultProps}
        connectedAddress={null}
        onApprove={onApprove}
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    fireEvent.click(approveButton);

    expect(onApprove).not.toHaveBeenCalled();
  });
});