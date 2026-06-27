import { render, screen } from '@testing-library/react';
import TextInput from '@/components/TextInput';

describe('TextInput', () => {
  it('renders label', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders input by role', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('associates label with input via htmlFor', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('uses provided id', () => {
    render(<TextInput label="Email" id="email-field" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'email-field');
  });

  it('derives id from label when id not provided', () => {
    render(<TextInput label="Full Name" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'full-name');
  });

  it('shows error message', () => {
    render(<TextInput label="Email" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('sets aria-invalid when error is present', () => {
    render(<TextInput label="Email" error="Required" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sets aria-invalid=false when no error', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });

  it('sets aria-describedby pointing to error element', () => {
    render(<TextInput label="Email" error="Required" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(screen.getByText('Required')).toHaveAttribute('id', 'email-error');
  });

  it('does not render error paragraph when no error', () => {
    render(<TextInput label="Email" />);
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });
});
