import { render, screen } from '@testing-library/react';
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import {
  TextInput,
  NumberInput,
  Textarea,
  Select,
  DatePicker,
  Toggle,
  Checkbox,
} from '@/components/FormInputs';

describe('FormInputs - aria-describedby', () => {
  describe('TextInput', () => {
    it('sets aria-describedby pointing to error element', () => {
      render(<TextInput id="email" label="Email" error="Required" />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('aria-describedby')).toBe('email-error');
      expect(screen.getByText('Required').getAttribute('id')).toBe('email-error');
    });

    it('sets aria-describedby pointing to helper text element', () => {
      render(<TextInput id="email" label="Email" helperText="Your email address" />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('aria-describedby')).toBe('email-helper');
      expect(screen.getByText('Your email address').getAttribute('id')).toBe('email-helper');
    });

    it('does not set aria-describedby when no error or helper text', () => {
      render(<TextInput id="email" label="Email" />);
      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('sets aria-invalid when error is present', () => {
      render(<TextInput id="email" label="Email" error="Invalid email" />);
      expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
    });

    it('sets aria-invalid=false when no error', () => {
      render(<TextInput id="email" label="Email" />);
      expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('false');
    });
  });

  describe('NumberInput', () => {
    it('sets aria-describedby pointing to error element', () => {
      render(<NumberInput id="count" label="Count" error="Must be positive" />);
      const input = screen.getByRole('spinbutton');
      expect(input.getAttribute('aria-describedby')).toBe('count-error');
      expect(screen.getByText('Must be positive').getAttribute('id')).toBe('count-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(<NumberInput id="count" label="Count" helperText="Minimum 1" />);
      const input = screen.getByRole('spinbutton');
      expect(input.getAttribute('aria-describedby')).toBe('count-helper');
    });
  });

  describe('Textarea', () => {
    it('sets aria-describedby pointing to error element', () => {
      render(<Textarea id="notes" label="Notes" error="Too long" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea.getAttribute('aria-describedby')).toBe('notes-error');
      expect(screen.getByText('Too long')).getAttribute('id').toBe('notes-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(<Textarea id="notes" label="Notes" helperText="Max 500 characters" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea.getAttribute('aria-describedby')).toBe('notes-helper');
    });
  });

  describe('Select', () => {
    const options = [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
    ];

    it('sets aria-describedby pointing to error element', () => {
      render(<Select id="choice" label="Choice" options={options} error="Invalid" />);
      const select = screen.getByRole('combobox');
      expect(select.getAttribute('aria-describedby')).toBe('choice-error');
      expect(screen.getByText('Invalid')).getAttribute('id').toBe('choice-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(<Select id="choice" label="Choice" options={options} helperText="Pick one" />);
      const select = screen.getByRole('combobox');
      expect(select.getAttribute('aria-describedby')).toBe('choice-helper');
    });
  });

  describe('DatePicker', () => {
    it('sets aria-describedby pointing to error element', () => {
      render(<DatePicker id="date" label="Date" error="Invalid date" />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('aria-describedby')).toBe('date-error');
      expect(screen.getByText('Invalid date')).getAttribute('id').toBe('date-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(<DatePicker id="date" label="Date" helperText="YYYY-MM-DD" />);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('aria-describedby')).toBe('date-helper');
    });
  });

  describe('Toggle', () => {
    it('sets aria-describedby pointing to error element', () => {
      render(
        <Toggle
          id="enabled"
          label="Enabled"
          checked={false}
          onChange={() => {}}
          error="Must be enabled"
        />
      );
      const button = screen.getByRole('switch');
      expect(button.getAttribute('aria-describedby')).toBe('enabled-error');
      expect(screen.getByText('Must be enabled')).getAttribute('id').toBe('enabled-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(
        <Toggle
          id="enabled"
          label="Enabled"
          checked={false}
          onChange={() => {}}
          helperText="Turn this on to proceed"
        />
      );
      const button = screen.getByRole('switch');
      expect(button.getAttribute('aria-describedby')).toBe('enabled-helper');
    });
  });

  describe('Checkbox', () => {
    it('sets aria-describedby pointing to error element', () => {
      render(
        <Checkbox
          id="accept"
          label="Accept"
          checked={false}
          onChange={() => {}}
          error="You must accept"
        />
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox.getAttribute('aria-describedby')).toBe('accept-error');
      expect(screen.getByText('You must accept')).getAttribute('id').toBe('accept-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(
        <Checkbox
          id="accept"
          label="Accept"
          checked={false}
          onChange={() => {}}
          helperText="I agree to the terms"
        />
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox.getAttribute('aria-describedby')).toBe('accept-helper');
    });
  });
});
