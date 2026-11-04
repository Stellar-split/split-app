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
      expect(input).to.have.property('getAttribute', 'aria-describedby', 'email-error');
      expect(screen.getByText('Required')).to.have.property('getAttribute', 'id', 'email-error');
    });

    it('sets aria-describedby pointing to helper text element', () => {
      render(<TextInput id="email" label="Email" helperText="Your email address" />);
      const input = screen.getByRole('textbox');
      expect(input).to.have.property('getAttribute', 'aria-describedby', 'email-helper');
      expect(screen.getByText('Your email address')).to.have.property('getAttribute', 'id', 'email-helper');
    });

    it('does not set aria-describedby when no error or helper text', () => {
      render(<TextInput id="email" label="Email" />);
      const input = screen.getByRole('textbox');
      expect(input).not.to.have.property('getAttribute', 'aria-describedby');
    });

    it('sets aria-invalid when error is present', () => {
      render(<TextInput id="email" label="Email" error="Invalid email" />);
      expect(screen.getByRole('textbox')).to.have.property('getAttribute', 'aria-invalid', 'true');
    });

    it('sets aria-invalid=false when no error', () => {
      render(<TextInput id="email" label="Email" />);
      expect(screen.getByRole('textbox')).to.have.property('getAttribute', 'aria-invalid', 'false');
    });
  });

  describe('NumberInput', () => {
    it('sets aria-describedby pointing to error element', () => {
      render(<NumberInput id="count" label="Count" error="Must be positive" />);
      const input = screen.getByRole('spinbutton');
      expect(input).to.have.property('getAttribute', 'aria-describedby', 'count-error');
      expect(screen.getByText('Must be positive')).to.have.property('getAttribute', 'id', 'count-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(<NumberInput id="count" label="Count" helperText="Minimum 1" />);
      const input = screen.getByRole('spinbutton');
      expect(input).to.have.property('getAttribute', 'aria-describedby', 'count-helper');
    });
  });

  describe('Textarea', () => {
    it('sets aria-describedby pointing to error element', () => {
      render(<Textarea id="notes" label="Notes" error="Too long" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).to.have.property('getAttribute', 'aria-describedby', 'notes-error');
      expect(screen.getByText('Too long')).to.have.property('getAttribute', 'id', 'notes-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(<Textarea id="notes" label="Notes" helperText="Max 500 characters" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).to.have.property('getAttribute', 'aria-describedby', 'notes-helper');
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
      expect(select).to.have.property('getAttribute', 'aria-describedby', 'choice-error');
      expect(screen.getByText('Invalid')).to.have.property('getAttribute', 'id', 'choice-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(<Select id="choice" label="Choice" options={options} helperText="Pick one" />);
      const select = screen.getByRole('combobox');
      expect(select).to.have.property('getAttribute', 'aria-describedby', 'choice-helper');
    });
  });

  describe('DatePicker', () => {
    it('sets aria-describedby pointing to error element', () => {
      render(<DatePicker id="date" label="Date" error="Invalid date" />);
      const input = screen.getByRole('textbox');
      expect(input).to.have.property('getAttribute', 'aria-describedby', 'date-error');
      expect(screen.getByText('Invalid date')).to.have.property('getAttribute', 'id', 'date-error');
    });

    it('sets aria-describedby pointing to helper text', () => {
      render(<DatePicker id="date" label="Date" helperText="YYYY-MM-DD" />);
      const input = screen.getByRole('textbox');
      expect(input).to.have.property('getAttribute', 'aria-describedby', 'date-helper');
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
      expect(button).to.have.property('getAttribute', 'aria-describedby', 'enabled-error');
      expect(screen.getByText('Must be enabled')).to.have.property('getAttribute', 'id', 'enabled-error');
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
      expect(button).to.have.property('getAttribute', 'aria-describedby', 'enabled-helper');
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
      expect(checkbox).to.have.property('getAttribute', 'aria-describedby', 'accept-error');
      expect(screen.getByText('You must accept')).to.have.property('getAttribute', 'id', 'accept-error');
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
      expect(checkbox).to.have.property('getAttribute', 'aria-describedby', 'accept-helper');
    });
  });
});
