import { render, screen, fireEvent } from '@testing-library/react';
import InvoiceShareQRModal from '@/components/InvoiceShareQRModal';
import { vi } from 'vitest';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  update: vi.fn(),
  dismiss: vi.fn(),
};

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

// Mock qrcode.react
vi.mock('qrcode.react', () => ({
  QRCodeCanvas: () => <div data-testid="mock-qr-canvas">QR Canvas</div>,
}));

describe('InvoiceShareQRModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open is true', () => {
    render(<InvoiceShareQRModal open={true} invoiceId="42" onClose={onClose} />);
    expect(screen.getByText('Share via QR Code')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<InvoiceShareQRModal open={false} invoiceId="42" onClose={onClose} />);
    expect(screen.queryByText('Share via QR Code')).not.toBeInTheDocument();
  });

  it('calls onClose when close button or dismiss is clicked', () => {
    render(<InvoiceShareQRModal open={true} invoiceId="42" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close share QR modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('copies link when copy link button is clicked', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    render(<InvoiceShareQRModal open={true} invoiceId="42" onClose={onClose} />);
    fireEvent.click(screen.getByText('Copy Link'));
    
    // Check it calls navigator.clipboard.writeText with the preview URL
    expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining('/invoice/42/preview'));
  });
});
