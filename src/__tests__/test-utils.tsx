import React from 'react';
import { render as rtlRender } from '@testing-library/react';

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function render(ui: React.ReactElement, options?: any) {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
}

export * from '@testing-library/react';
