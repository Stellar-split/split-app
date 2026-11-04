import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton, InvoiceCardSkeleton } from '@/components/Skeleton';

describe('Skeleton', () => {
  it('renders with skeleton-shimmer class', () => {
    const { container } = render(<Skeleton />);
    const skeletonDiv = container.querySelector('div');
    expect(skeletonDiv).to.have.property('className') // contains 'skeleton-shimmer';
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const skeletonDiv = container.querySelector('div');
    expect(skeletonDiv).to.have.property('className') // contains 'h-4';
    expect(skeletonDiv).to.have.property('className') // contains 'w-24';
    expect(skeletonDiv).to.have.property('className') // contains 'skeleton-shimmer';
  });

  it('has proper base styles', () => {
    const { container } = render(<Skeleton />);
    const skeletonDiv = container.querySelector('div');
    expect(skeletonDiv).to.have.property('className') // contains 'bg-gray-200';
    expect(skeletonDiv).to.have.property('className') // contains 'dark:bg-gray-700';
    expect(skeletonDiv).to.have.property('className') // contains 'rounded';
  });

  it('renders InvoiceCardSkeleton with proper ARIA attributes', () => {
    const { container } = render(<InvoiceCardSkeleton />);
    const skeleton = container.querySelector('[role="status"]');
    expect(skeleton).to.have.property('getAttribute', 'aria-busy', 'true');
    expect(skeleton).to.have.property('getAttribute', 'aria-label', 'Loading invoice data');
  });
});
