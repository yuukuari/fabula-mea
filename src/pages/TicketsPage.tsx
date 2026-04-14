import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  EyeOff, MessageSquare, Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTicketStore } from '@/store/useTicketStore';
import { useReleaseStore } from '@/store/useReleaseStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { PushOptInModal, shouldPromptPushOptIn } from '@/components/notifications/PushOptInModal';
import { TYPE_CONFIG, STATUS_CONFIG, MODULE_LABELS } from '@/components/tickets/ticket-constants';
import type { Ticket, TicketType, TicketModule, Release } from '@/types';

export function TicketsPage() {
  const { tickets, loadTickets, isLoading } = useTicketStore();
  const releases = useReleaseStore((s) => s.releases);
  const loadReleases = useReleaseStore((s) => s.loadReleases);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TicketType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [moduleFilter, setModuleFilter] = useState<'all' | TicketModule>('all');
  const [releaseFilter, setReleaseFilter] = useState<string>('all');
  const [showPushOptIn, setShowPushOptIn] = useState(false);

  useEffect(() => {
    loadTickets();
    loadReleases();
    // Prompt push opt-in after a short delay
    const timer = setTimeout(() => {
      if (shouldPromptPushOptIn()) setShowPushOptIn(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Read releaseId or id (deep link from notification) from URL params on mount
  useEffect(() => {
    const releaseId = searchParams.get('releaseId');
    if (releaseId) {
      setReleaseFilter(releaseId);
      setStatusFilter('all');
      searchParams.delete('releaseId');
      setSearchParams(searchParams, { replace: true });
    }
    const ticketId = searchParams.get('id');
    if (ticketId) {
      setSelectedId(ticketId);
      setStatusFilter('all');
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = tickets
    .filter((t) => filter === 'all' || t.type === filter)
    .filter((t) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'open') return t.status === 'open';
      return t.status !== 'open';
    })
    .filter((t) => {
      if (moduleFilter === 'all') return true;
      return t.module === moduleFilter;
    })
    .filter((t) => {
      if (releaseFilter === 'all') return true;
      return t.releaseId === releaseFilter;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (selectedId) {
    return (
      <>
        <TicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />
        <PushOptInModal open={showPushOptIn} onClose={() => setShowPushOptIn(false)} />
      </>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title">Tickets</h1>
        <span className="text-sm text-ink-200">{filtered.length} ticket{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 bg-parchment-100 rounded-lg p-1">
          {[
            { value: 'all' as const, label: 'Tous' },
            { value: 'bug' as const, label: '🐛 Bugs' },
            { value: 'question' as const, label: '❓ Questions' },
            { value: 'improvement' as const, label: '✨ Améliorations' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                filter === f.value ? 'bg-white shadow-sm text-ink-500 font-medium' : 'text-ink-300 hover:text-ink-400'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-parchment-100 rounded-lg p-1">
          {[
            { value: 'all' as const, label: 'Tous statuts' },
            { value: 'open' as const, label: 'Ouverts' },
            { value: 'closed' as const, label: 'Fermés' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                statusFilter === f.value ? 'bg-white shadow-sm text-ink-500 font-medium' : 'text-ink-300 hover:text-ink-400'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value as 'all' | TicketModule)}
          className="text-sm border border-parchment-300 rounded-lg px-3 py-1.5 bg-white text-ink-400"
        >
          <option value="all">Toutes sections</option>
          {Object.entries(MODULE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {releases.length > 0 && (
          <select
            value={releaseFilter}
            onChange={(e) => setReleaseFilter(e.target.value)}
            className="text-sm border border-parchment-300 rounded-lg px-3 py-1.5 bg-white text-ink-400"
          >
            <option value="all">Toutes versions</option>
            {releases
              .filter((r) => r.status !== 'draft')
              .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
              .map((r) => (
                <option key={r.id} value={r.id}>v{r.version}{r.title ? ` — ${r.title}` : ''}</option>
              ))}
          </select>
        )}
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-ink-200">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun ticket pour le moment</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              releases={releases}
              onClick={() => setSelectedId(ticket.id)}
            />
          ))}
        </div>
      )}
      <PushOptInModal open={showPushOptIn} onClose={() => setShowPushOptIn(false)} />
    </div>
  );
}

function TicketRow({ ticket, releases, onClick }: { ticket: Ticket; releases: Release[]; onClick: () => void }) {
  const typeConf = TYPE_CONFIG[ticket.type];
  const statusConf = STATUS_CONFIG[ticket.status];
  const TypeIcon = typeConf.icon;
  const release = ticket.releaseId ? releases.find((r) => r.id === ticket.releaseId) : null;
  const unreadCount = useNotificationStore((s) => s.unreadCountForTicket(ticket.id));

  return (
    <button
      onClick={onClick}
      className="w-full card-fantasy p-4 text-left flex items-start gap-4 group"
    >
      <div className={cn('badge', typeConf.color)}>
        <TypeIcon className="w-3.5 h-3.5 mr-1" />
        {typeConf.label}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-ink-500 group-hover:text-bordeaux-500 transition-colors truncate">
          {ticket.title}
        </h3>
        <div className="flex items-center gap-3 mt-1 text-xs text-ink-200">
          <span>{ticket.userName}</span>
          <span>•</span>
          <span>{new Date(ticket.createdAt).toLocaleDateString('fr-FR')}</span>
          {ticket.module && MODULE_LABELS[ticket.module] && (
            <>
              <span>•</span>
              <span className="badge bg-purple-50 text-purple-600 text-[10px] py-0 px-1.5">{MODULE_LABELS[ticket.module]}</span>
            </>
          )}
          {ticket.visibility === 'private' && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Privé</span>
            </>
          )}
          {release && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 badge bg-blue-50 text-blue-600 text-[10px] py-0 px-1.5">
                <Tag className="w-3 h-3" />
                v{release.version}
              </span>
            </>
          )}
          {(ticket.commentCount ?? 0) > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {ticket.commentCount}
              </span>
            </>
          )}
        </div>
      </div>
      {unreadCount > 0 && (
        <span className="text-[10px] font-bold bg-bordeaux-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight flex-shrink-0">
          {unreadCount}
        </span>
      )}
      <div className={cn('badge', statusConf.color)}>
        {statusConf.label}
      </div>
    </button>
  );
}
