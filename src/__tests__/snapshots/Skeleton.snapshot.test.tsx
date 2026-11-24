import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';

describe('Skeleton snapshots', () => {
  it('renders the base Skeleton primitive', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const skeleton = container.querySelector('.skeleton');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
    expect(skeleton?.getAttribute('class')).toContain('h-4');
    expect(skeleton?.getAttribute('class')).toContain('w-24');
  });

  it('renders SkeletonCard', () => {
    const { container } = render(<SkeletonCard />);
    const card = container.querySelector('.skeleton-card');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('role')).toBe('status');
    expect(card?.getAttribute('aria-busy')).toBe('true');
    expect(card?.getAttribute('aria-label')).toBe('Loading invoice data');
    expect(card?.querySelectorAll('.skeleton').length).toBe(2);
  });
});
