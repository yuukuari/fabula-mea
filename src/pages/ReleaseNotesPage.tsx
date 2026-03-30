import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bug, Sparkles, Zap, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReleaseStore } from '@/store/useReleaseStore';
import { useTicketStore } from '@/store/useTicketStore';
import type { Release, ReleaseStatus, ReleaseItemType } from '@/types';

const STATUS_COLORS: Record<ReleaseStatus, string> = {
  current: 'bg-green-500',
  released: 'bg-ink-300',
  planned: 'bg-blue-400',
  draft: 'bg-yellow-400',
};

const STATUS_LABELS: Record<ReleaseStatus, string> = {
  current: 'Version actuelle',
  released: 'Publiée',
  planned: 'À venir',
  draft: 'Brouillon',
};

const ITEM_TYPE_CONFIG: Record<ReleaseItemType, { icon: typeof Bug; label: string; color: string }> = {
  bugfix: { icon: Bug, label: 'Correction', color: 'text-red-500' },
  improvement: { icon: Sparkles, label: 'Amélioration', color: 'text-blue-500' },
  feature: { icon: Zap, label: 'Nouveauté', color: 'text-green-500' },
};

export function ReleaseNotesPage() {
  const navigate = useNavigate();
  const { releases, loadReleases, isLoading } = useReleaseStore();
  const { tickets, loadTickets } = useTicketStore();

  useEffect(() => {
    loadReleases();
    loadTickets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort: current first, then planned (by version desc), then released (by version desc)
  // Drafts are already filtered out by the API for non-admins
  const sorted = [...releases].sort((a, b) => {
    const statusOrder: Record<ReleaseStatus, number> = { draft: -1, planned: 0, current: 1, released: 2 };
    const orderDiff = statusOrder[a.status] - statusOrder[b.status];
    if (orderDiff !== 0) return orderDiff;
    return b.version.localeCompare(a.version, undefined, { numeric: true });
  });

  return (
    <div className="page-container max-w-3xl">
      <h1 className="section-title mb-2">Notes de version</h1>
      <p className="text-sm text-ink-300 mb-8">
        Historique des mises à jour et améliorations du site.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-center text-ink-200 py-12">Aucune release pour le moment.</p>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-parchment-300" />

          <div className="space-y-8">
            {sorted.map((release, idx) => (
              <ReleaseEntry key={release.id} release={release} tickets={tickets} isFirst={idx === 0} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReleaseEntry({
  release,
  tickets,
  isFirst,
}: {
  release: Release;
  tickets: Array<{ id: string; userName: string }>;
  isFirst: boolean;
}) {
  const isCurrent = release.status === 'current';

  // Find contributors: users who created tickets linked to this release
  const contributors = release.ticketIds
    .map((tid) => tickets.find((t) => t.id === tid))
    .filter(Boolean)
    .map((t) => t!.userName);
  const uniqueContributors = [...new Set(contributors)];

  return (
    <div className="relative pl-12">
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-2.5 w-3 h-3 rounded-full border-2 border-white',
          isCurrent ? 'bg-green-500 ring-4 ring-green-100' : STATUS_COLORS[release.status]
        )}
        style={{ top: '0.4rem' }}
      />

      <div className={cn('card-fantasy p-5', isCurrent && 'ring-2 ring-green-200')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display font-bold text-lg text-ink-500">
                v{release.version}
              </h2>
              <span
                className={cn(
                  'badge text-[10px]',
                  isCurrent
                    ? 'bg-green-100 text-green-700'
                    : release.status === 'planned'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-500'
                )}
              >
                {STATUS_LABELS[release.status]}
              </span>
            </div>
            <h3 className="text-sm font-medium text-ink-400">{release.title || `Release v${release.version}`}</h3>
          </div>
          {release.releasedAt && (
            <span className="text-xs text-ink-200 flex-shrink-0">
              {new Date(release.releasedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          )}
        </div>

        {/* Description */}
        {release.description && (
          <div
            className="prose prose-sm max-w-none text-ink-300 mb-4"
            dangerouslySetInnerHTML={{ __html: release.description }}
          />
        )}

        {/* Items */}
        {release.items.length > 0 && (
          <div className="space-y-2 mb-4">
            {release.items.map((item) => {
              const conf = ITEM_TYPE_CONFIG[item.type];
              const Icon = conf.icon;
              return (
                <div key={item.id} className="flex items-start gap-2 text-sm">
                  <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', conf.color)} />
                  <span className="text-ink-400">{item.description}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Contributors */}
        {uniqueContributors.length > 0 && (
          <div className="pt-3 border-t border-parchment-200">
            <div className="flex items-center gap-2 text-xs text-ink-300">
              <Users className="w-3.5 h-3.5 text-gold-500" />
              <span className="font-medium text-gold-600">Merci aux contributeurs :</span>
              <span>{uniqueContributors.join(', ')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
