import { render, screen, fireEvent } from '@testing-library/react';
import LineItemRow from '@/components/LineItemRow';

// Mock dependencies
jest.mock('@/components/settings/AddressBookPicker', () => {
  return function MockAddressBookPicker({ value, onChange, placeholder, ariaLabel }: any) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    );
  };
});

jest.mock('@/components/ui/Avatar', () => {
  return function MockAvatar({ address }: any) {
    return <div data-testid="avatar">{address}</div>;
  };
});

jest.mock('@/components/EmailField', () => {
  return function MockEmailField({ email, onEmailChange }: any) {
    return (
      <input
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="email@example.com"
      />
    );
  };
});

describe('LineItemRow', () => {
  const mockProps = {
    index: 0,
    address: 'GTEST123',
    amount: '100',
    label: 'Test User',
    email: 'test@example.com',
    equalSplit: false,
    amountOverride: undefined,
    amountSuggestions: [],
    activeField: null as const,
    activeIndex: null,
    canRemove: true,
    emailByAddress: { GTEST123: 'test@example.com' },
    onAddressChange: jest.fn(),
    onAmountChange: jest.fn(),
    onAmountFocus: jest.fn(),
    onAmountSuggestionSelect: jest.fn(),
    onRemove: jest.fn(),
    onEmailChange: jest.fn(),
  };

  it('should render address input', () => {
    render(<LineItemRow {...mockProps} />);
    const addressInput = screen.getByDisplayValue('GTEST123');
    expect(addressInput).toBeInTheDocument();
  });

  it('should render amount input', () => {
    render(<LineItemRow {...mockProps} />);
    const amountInput = screen.getByDisplayValue('100');
    expect(amountInput).toBeInTheDocument();
  });

  it('should render email input', () => {
    render(<LineItemRow {...mockProps} />);
    const emailInput = screen.getByDisplayValue('test@example.com');
    expect(emailInput).toBeInTheDocument();
  });

  it('should render avatar with address', () => {
    render(<LineItemRow {...mockProps} />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('GTEST123');
  });

  it('should render remove button when canRemove is true', () => {
    render(<LineItemRow {...mockProps} canRemove={true} />);
    const removeButton = screen.getByRole('button', { name: /remove recipient 1/i });
    expect(removeButton).toBeInTheDocument();
  });

  it('should not render remove button when canRemove is false', () => {
    render(<LineItemRow {...mockProps} canRemove={false} />);
    const removeButton = screen.queryByRole('button', { name: /remove recipient 1/i });
    expect(removeButton).not.toBeInTheDocument();
  });

  it('should call onRemove when remove button is clicked', () => {
    const { onRemove } = mockProps;
    render(<LineItemRow {...mockProps} />);
    const removeButton = screen.getByRole('button', { name: /remove recipient 1/i });
    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalled();
  });

  it('should call onAddressChange when address changes', () => {
    const { onAddressChange } = mockProps;
    render(<LineItemRow {...mockProps} />);
    const addressInput = screen.getByDisplayValue('GTEST123');
    fireEvent.change(addressInput, { target: { value: 'GNEWADDRESS' } });
    expect(onAddressChange).toHaveBeenCalledWith('GNEWADDRESS', mockProps.email, mockProps.email);
  });

  it('should call onAmountChange when amount changes', () => {
    const { onAmountChange } = mockProps;
    render(<LineItemRow {...mockProps} />);
    const amountInput = screen.getByDisplayValue('100');
    fireEvent.change(amountInput, { target: { value: '200' } });
    expect(onAmountChange).toHaveBeenCalledWith('200');
  });

  it('should call onAmountFocus when amount input is focused', () => {
    const { onAmountFocus } = mockProps;
    render(<LineItemRow {...mockProps} />);
    const amountInput = screen.getByDisplayValue('100');
    fireEvent.focus(amountInput);
    expect(onAmountFocus).toHaveBeenCalled();
  });

  it('should call onEmailChange when email changes', () => {
    const { onEmailChange } = mockProps;
    render(<LineItemRow {...mockProps} />);
    const emailInput = screen.getByDisplayValue('test@example.com');
    fireEvent.change(emailInput, { target: { value: 'newemail@example.com' } });
    expect(onEmailChange).toHaveBeenCalledWith('newemail@example.com');
  });

  it('should disable amount input when equalSplit is true', () => {
    render(<LineItemRow {...mockProps} equalSplit={true} />);
    const amountInput = screen.getByDisplayValue('100');
    expect((amountInput as HTMLInputElement).readOnly).toBe(true);
  });

  it('should show amount suggestions when available', () => {
    render(
      <LineItemRow
        {...mockProps}
        amountSuggestions={['50', '150']}
        activeField="amount"
        activeIndex={0}
      />
    );
    expect(screen.getByText('50 USDC')).toBeInTheDocument();
    expect(screen.getByText('150 USDC')).toBeInTheDocument();
  });

  it('should call onAmountSuggestionSelect when suggestion is clicked', () => {
    const { onAmountSuggestionSelect } = mockProps;
    render(
      <LineItemRow
        {...mockProps}
        amountSuggestions={['50', '150']}
        activeField="amount"
        activeIndex={0}
      />
    );
    const suggestionButton = screen.getByText('50 USDC');
    fireEvent.mouseDown(suggestionButton);
    expect(onAmountSuggestionSelect).toHaveBeenCalledWith('50');
  });
});
