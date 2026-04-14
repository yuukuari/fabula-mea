import { useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/useNotificationStore';
import { NotificationModal } from './NotificationModal';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const buttonRef = useRef<HTMLButtonElement>(null);

  const getPosition = () => {
    if (!buttonRef.current) return { top: 0, left: 0 };
    const rect = buttonRef.current.getBoundingClientRect();
    return { top: rect.bottom + 8, left: rect.left };
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(
          'p-2 rounded-lg transition-colors relative',
          open
            ? 'bg-bordeaux-50 text-bordeaux-500'
            : 'text-ink-300 hover:text-ink-500 hover:bg-parchment-200'
        )}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 text-[10px] font-bold bg-bordeaux-500 text-white rounded-full px-1 py-0 min-w-[16px] text-center leading-4">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationModal open={open} onClose={() => setOpen(false)} getPosition={getPosition} />
    </>
  );
}
