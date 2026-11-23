'use client';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { parseDeepLink, resolveNotificationRoute } from '@/lib/mobileNotifications';
import type { MobileNotificationPayload } from '@/lib/mobileNotifications';

export function useNotificationRouting() {
  const router = useRouter();

  const navigateToNotification = useCallback(
    (payload: Pick<MobileNotificationPayload, 'deepLink' | 'category' | 'data'>) => {
      const target =
        payload.deepLink ??
        (payload.category ? resolveNotificationRoute(payload.category, payload.data) : '/dashboard');
      router.push(target);
    },
    [router]
  );

  const navigateToDeepLink = useCallback(
    (deepLink: string) => {
      const { route, params } = parseDeepLink(deepLink);
      const qs = Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
      router.push(`${route}${qs}`);
    },
    [router]
  );

  return { navigateToNotification, navigateToDeepLink };
}
