import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AccessibilityProvider,
  useAccessibility,
} from '@/contexts/AccessibilityContext';

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-reduced-motion');
  document.documentElement.removeAttribute('data-contrast');
  document.documentElement.style.removeProperty('--font-scale');
});

// Test component that uses the accessibility context
function TestComponent() {
  const {
    fontScale,
    setFontScale,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
  } = useAccessibility();

  return (
    <div>
      <div data-testid="font-scale">{fontScale}</div>
      <button onClick={() => setFontScale(115)} data-testid="set-font-115">
        Set Font 115%
      </button>
      <button onClick={() => setFontScale(130)} data-testid="set-font-130">
        Set Font 130%
      </button>

      <div data-testid="reduced-motion">{reducedMotion ? 'true' : 'false'}</div>
      <button
        onClick={() => setReducedMotion(!reducedMotion)}
        data-testid="toggle-reduced-motion"
      >
        Toggle Reduced Motion
      </button>

      <div data-testid="high-contrast">{highContrast}</div>
      <button onClick={() => setHighContrast('high')} data-testid="set-contrast-high">
        Set Contrast High
      </button>
      <button onClick={() => setHighContrast('normal')} data-testid="set-contrast-normal">
        Set Contrast Normal
      </button>
    </div>
  );
}

describe('AccessibilityContext', () => {
  describe('Font Scale', () => {
    it('should apply default font scale (100%)', () => {
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('font-scale')).toHaveTextContent('100');
      expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe(
        '1'
      );
    });

    it('should apply font scale 115%', async () => {
      const user = userEvent.setup();
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('set-font-115'));

      await waitFor(() => {
        expect(screen.getByTestId('font-scale')).toHaveTextContent('115');
        expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe(
          '1.15'
        );
      });
    });

    it('should apply font scale 130%', async () => {
      const user = userEvent.setup();
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('set-font-130'));

      await waitFor(() => {
        expect(screen.getByTestId('font-scale')).toHaveTextContent('130');
        expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe(
          '1.3'
        );
      });
    });

    it('should persist font scale to localStorage', async () => {
      const user = userEvent.setup();
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('set-font-115'));

      await waitFor(() => {
        const stored = JSON.parse(
          localStorage.getItem('accessibility-settings') || '{}'
        );
        expect(stored.fontScale).toBe(115);
      });
    });

    it('should restore font scale from localStorage', () => {
      localStorage.setItem(
        'accessibility-settings',
        JSON.stringify({ fontScale: 130, reducedMotion: false, highContrast: 'normal' })
      );

      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('font-scale')).toHaveTextContent('130');
      expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe(
        '1.3'
      );
    });
  });

  describe('Reduced Motion', () => {
    it('should have reduced motion disabled by default', () => {
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('reduced-motion')).toHaveTextContent('false');
      expect(
        document.documentElement.getAttribute('data-reduced-motion')
      ).toBeNull();
    });

    it('should set data-reduced-motion attribute when enabled', async () => {
      const user = userEvent.setup();
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('toggle-reduced-motion'));

      await waitFor(() => {
        expect(screen.getByTestId('reduced-motion')).toHaveTextContent('true');
        expect(
          document.documentElement.getAttribute('data-reduced-motion')
        ).toBe('true');
      });
    });

    it('should remove data-reduced-motion attribute when disabled', async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        'accessibility-settings',
        JSON.stringify({ fontScale: 100, reducedMotion: true, highContrast: 'normal' })
      );

      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('toggle-reduced-motion'));

      await waitFor(() => {
        expect(screen.getByTestId('reduced-motion')).toHaveTextContent('false');
        expect(
          document.documentElement.getAttribute('data-reduced-motion')
        ).toBeNull();
      });
    });

    it('should persist reduced motion to localStorage', async () => {
      const user = userEvent.setup();
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('toggle-reduced-motion'));

      await waitFor(() => {
        const stored = JSON.parse(
          localStorage.getItem('accessibility-settings') || '{}'
        );
        expect(stored.reducedMotion).toBe(true);
      });
    });

    it('should restore reduced motion from localStorage', () => {
      localStorage.setItem(
        'accessibility-settings',
        JSON.stringify({ fontScale: 100, reducedMotion: true, highContrast: 'normal' })
      );

      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('reduced-motion')).toHaveTextContent('true');
      expect(
        document.documentElement.getAttribute('data-reduced-motion')
      ).toBe('true');
    });
  });

  describe('High Contrast', () => {
    it('should have normal contrast by default', () => {
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('high-contrast')).toHaveTextContent('normal');
      expect(document.documentElement.getAttribute('data-contrast')).toBe(
        'normal'
      );
    });

    it('should set data-contrast="high" when high contrast enabled', async () => {
      const user = userEvent.setup();
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('set-contrast-high'));

      await waitFor(() => {
        expect(screen.getByTestId('high-contrast')).toHaveTextContent('high');
        expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
      });
    });

    it('should set data-contrast="normal" when switching back', async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        'accessibility-settings',
        JSON.stringify({ fontScale: 100, reducedMotion: false, highContrast: 'high' })
      );

      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('set-contrast-normal'));

      await waitFor(() => {
        expect(screen.getByTestId('high-contrast')).toHaveTextContent('normal');
        expect(document.documentElement.getAttribute('data-contrast')).toBe(
          'normal'
        );
      });
    });

    it('should persist high contrast to localStorage', async () => {
      const user = userEvent.setup();
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('set-contrast-high'));

      await waitFor(() => {
        const stored = JSON.parse(
          localStorage.getItem('accessibility-settings') || '{}'
        );
        expect(stored.highContrast).toBe('high');
      });
    });

    it('should restore high contrast from localStorage', () => {
      localStorage.setItem(
        'accessibility-settings',
        JSON.stringify({ fontScale: 100, reducedMotion: false, highContrast: 'high' })
      );

      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('high-contrast')).toHaveTextContent('high');
      expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
    });
  });

  describe('Persistence and Hydration', () => {
    it('should hydrate all settings from localStorage on mount', () => {
      const settings = {
        fontScale: 115,
        reducedMotion: true,
        highContrast: 'high',
      };
      localStorage.setItem('accessibility-settings', JSON.stringify(settings));

      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('font-scale')).toHaveTextContent('115');
      expect(screen.getByTestId('reduced-motion')).toHaveTextContent('true');
      expect(screen.getByTestId('high-contrast')).toHaveTextContent('high');

      expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe(
        '1.15'
      );
      expect(
        document.documentElement.getAttribute('data-reduced-motion')
      ).toBe('true');
      expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
    });

    it('should use default settings when localStorage is empty', () => {
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('font-scale')).toHaveTextContent('100');
      expect(screen.getByTestId('reduced-motion')).toHaveTextContent('false');
      expect(screen.getByTestId('high-contrast')).toHaveTextContent('normal');
    });

    it('should sync multiple setting changes to localStorage', async () => {
      const user = userEvent.setup();
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      await user.click(screen.getByTestId('set-font-115'));
      await user.click(screen.getByTestId('toggle-reduced-motion'));
      await user.click(screen.getByTestId('set-contrast-high'));

      await waitFor(() => {
        const stored = JSON.parse(
          localStorage.getItem('accessibility-settings') || '{}'
        );
        expect(stored).toEqual({
          fontScale: 115,
          reducedMotion: true,
          highContrast: 'high',
        });
      });
    });
  });

  describe('useAccessibility hook', () => {
    it('should throw error when used outside provider', () => {
      const ThrowingComponent = () => {
        useAccessibility();
        return null;
      };

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => render(<ThrowingComponent />)).toThrow(
        'useAccessibility must be used within AccessibilityProvider'
      );

      consoleError.mockRestore();
    });
  });
});
