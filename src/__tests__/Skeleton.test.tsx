import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton } from '@/components/Skeleton';

describe('Skeleton', () => {
  it('renders with skeleton-shimmer class', () => {
    const { container } = render(<Skeleton />);
    const skeletonDiv = container.querySelector('div');
    expect(skeletonDiv).toHaveClass('skeleton-shimmer');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const skeletonDiv = container.querySelector('div');
    expect(skeletonDiv).toHaveClass('h-4');
    expect(skeletonDiv).toHaveClass('w-24');
    expect(skeletonDiv).toHaveClass('skeleton-shimmer');
  });

  it('has proper base styles', () => {
    const { container } = render(<Skeleton />);
    const skeletonDiv = container.querySelector('div');
    expect(skeletonDiv).toHaveClass('bg-gray-200');
    expect(skeletonDiv).toHaveClass('dark:bg-gray-700');
    expect(skeletonDiv).toHaveClass('rounded');
  });

  it('renders InvoiceCardSkeleton with proper ARIA attributes', () => {
    const { render: customRender } = require('@testing-library/react');
    const { InvoiceCardSkeleton } = require('@/components/Skeleton');
    const { container } = customRender(<InvoiceCardSkeleton />);
    const skeleton = container.querySelector('[role="status"]');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton).toHaveAttribute('aria-label', 'Loading invoice data');
  });
});
