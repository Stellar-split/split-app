import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';

describe('Skeleton snapshots', () => {
  it('renders the base Skeleton primitive', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.innerHTML).toBeTruthy();
  });

  it('renders SkeletonCard', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.innerHTML).toBeTruthy();
  });
});
