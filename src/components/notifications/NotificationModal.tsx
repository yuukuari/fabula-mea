import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, BookOpen, Check, CheckCheck, CheckCircle2, MessageSquare, X } from 'lucide-react';
import { cn, resolveTemplate } from '@/lib/utils';
import { useNotificationStore } from '@/store/useNotificationStore';
import { isPushSupported, getPushPermission, subscribeToPush } from '@/lib/push';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AppNotification } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  getPosition: () => { top: number; left: number };
}

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  ticket_comment: MessageSquare,
  review_comments_sent: BookOpen,
  review_completed: CheckCircle2,
};

function NotificationItem({
  notification,
  isRead,
  onMarkRead,
  onClick,
}: {
  notification: AppNotification;
  isRead: boolean;
  onMarkRead: () => void;
  onClick: () => void;
}) {
  const Icon = TYPE_ICONS[notification.type] ?? Bell;

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-parchment-200 last:border-0 transition-colors',
        isRead ? 'bg-white' : 'bg-bordeaux-50/50'
      )}
    >
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isRead ? 'bg-parchment-100 text-ink-200' : 'bg-bordeaux-100 text-bordeaux-500'
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
        <p className={cn('text-sm', isRead ? 'text-ink-300' : 'text-ink-500 font-medium')}>
          {resolveTemplate(notification.message, { actorName: notification.actorName, ...notification.payload })}
        </p>
        <p className="text-xs text-ink-200 mt-0.5">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })}
        </p>
      </button>
      {!isRead && (
        <button
          onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
          className="p-1.5 rounded-lg text-ink-200 hover:text-bordeaux-500 hover:bg-bordeaux-50 transition-colors flex-shrink-0"
          title="Marquer comme lu"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function NotificationModal({ open, onClose, getPosition }: Props) {
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);
  const { notifications, readIds, markRead, markAllRead } = useNotificationStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Compute position when opening
  useEffect(() => {
    if (open) {
      setPos(getPosition());
    }
  }, [open, getPosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close from the bell click
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const [pushState, setPushState] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    if (open && isPushSupported()) {
      const perm = getPushPermission();
      setPushState(perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'idle');
    }
  }, [open]);

  const handleEnablePush = async () => {
    setPushState('asking');
    const ok = await subscribeToPush();
    setPushState(ok ? 'granted' : 'denied');
  };

  if (!open) return null;

  const handleClick = (notification: AppNotification) => {
    markRead(notification.id);
    onClose();
    navigate(notification.link);
  };

  return (
    <div
      ref={modalRef}
      className="fixed w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-parchment-300 z-50 overflow-hidden"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-parchment-200 bg-parchment-50">
        <h3 className="text-sm font-semibold text-ink-500 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notifications
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold bg-bordeaux-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
              {unreadCount}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-bordeaux-500 hover:text-bordeaux-700 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-bordeaux-50 transition-colors"
              title="Tout marquer comme lu"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tout lire
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-ink-200 hover:text-ink-400 hover:bg-parchment-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-ink-200 text-sm">
            Aucune notification
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              isRead={readIds.has(n.id)}
              onMarkRead={() => markRead(n.id)}
              onClick={() => handleClick(n)}
            />
          ))
        )}
      </div>

      {/* Push notification opt-in */}
      {isPushSupported() && pushState === 'idle' && (
        <div className="px-4 py-3 border-t border-parchment-200 bg-parchment-50">
          <button
            onClick={handleEnablePush}
            className="w-full flex items-center gap-2 justify-center text-xs text-bordeaux-500 hover:text-bordeaux-700 font-medium py-1.5 rounded-lg hover:bg-bordeaux-50 transition-colors"
          >
            <BellRing className="w-3.5 h-3.5" />
            Activer les notifications du navigateur
          </button>
        </div>
      )}
    </div>
  );
}
