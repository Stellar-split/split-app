'use client';

import React, { useEffect, useRef } from 'react';
import type { InvoiceSectionFocus } from '@/types/presence';

interface InvoiceSectionProps {
  sectionId: InvoiceSectionFocus;
  onFocusChange: (section: InvoiceSectionFocus) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * InvoiceSection component wraps invoice sections and tracks when they enter/exit the viewport.
 * Uses IntersectionObserver to detect which section the user is currently viewing.
 */
export default function InvoiceSection({
  sectionId,
  onFocusChange,
  children,
  className = '',
}: InvoiceSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isInViewRef = useRef(false);

  useEffect(() => {
    if (!sectionRef.current) return;

    // Create IntersectionObserver to detect when section is in viewport
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Mark section as in view when it's at least 30% visible
          const isNowInView = entry.isIntersecting && entry.intersectionRatio >= 0.3;

          if (isNowInView && !isInViewRef.current) {
            // Section just came into view
            isInViewRef.current = true;
            onFocusChange(sectionId);
          } else if (!isNowInView && isInViewRef.current) {
            // Section just left view
            isInViewRef.current = false;
          }
        });
      },
      {
        threshold: [0.3], // Trigger when 30% of section is visible
        rootMargin: '0px',
      }
    );

    observerRef.current.observe(sectionRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [sectionId, onFocusChange]);

  return (
    <div ref={sectionRef} className={className}>
      {children}
    </div>
  );
}
