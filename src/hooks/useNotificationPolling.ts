import { useEffect, useRef } from 'react';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useAuthStore } from '@/store/useAuthStore';

const POLL_INTERVAL = 60_000; // 60 seconds

/**
 * Polls for notifications on mount and every 60 seconds.
 * Call this hook in a top-level layout component (Sidebar, HomeSidebar).
 */
export function useNotificationPolling() {
  const user = useAuthStore((s) => s.user);
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    // Initial load
    loadNotifications();

    // Poll every 60s
    intervalRef.current = setInterval(loadNotifications, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
}
