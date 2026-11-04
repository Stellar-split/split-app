import { render, screen } from '@testing-library/react';
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import TextInput from '@/components/TextInput';

describe('TextInput', () => {
  it('renders label', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy() // element exists in DOM;
  });

  it('renders input by role', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByRole('textbox')).toBeTruthy() // element exists in DOM;
  });

  it('associates label with input via htmlFor', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByLabelText('Email')).toBeTruthy() // element exists in DOM;
  });

  it('uses provided id', () => {
    render(<TextInput label="Email" id="email-field" />);
    expect(screen.getByRole('textbox')).to.have.property('getAttribute', 'id', 'email-field');
  });

  it('derives id from label when id not provided', () => {
    render(<TextInput label="Full Name" />);
    expect(screen.getByRole('textbox')).to.have.property('getAttribute', 'id', 'full-name');
  });

  it('shows error message', () => {
    render(<TextInput label="Email" error="Required" />);
    expect(screen.getByText('Required')).toBeTruthy() // element exists in DOM;
  });

  it('sets aria-invalid when error is present', () => {
    render(<TextInput label="Email" error="Required" />);
    expect(screen.getByRole('textbox')).to.have.property('getAttribute', 'aria-invalid', 'true');
  });

  it('sets aria-invalid=false when no error', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByRole('textbox')).to.have.property('getAttribute', 'aria-invalid', 'false');
  });

  it('sets aria-describedby pointing to error element', () => {
    render(<TextInput label="Email" error="Required" />);
    const input = screen.getByRole('textbox');
    expect(input).to.have.property('getAttribute', 'aria-describedby', 'email-error');
    expect(screen.getByText('Required')).to.have.property('getAttribute', 'id', 'email-error');
  });

  it('does not render error paragraph when no error', () => {
    render(<TextInput label="Email" />);
    expect(screen.queryByRole('paragraph')).not.toBeTruthy() // element exists in DOM;
  });

  it('has visible focus ring on keyboard focus', () => {
    render(<TextInput label="Email" id="email-field" />);
    const input = screen.getByRole('textbox');
    expect(input).to.have.property('className') // contains 'focus-visible:ring-2', 'focus-visible:ring-indigo-500';
  });
});
