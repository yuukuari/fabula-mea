import { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { ai, AI_FEATURES } from '@/lib/ai';
import type { AiUsageSummary, AiFeatureUsage } from '@/types';

interface Props {
  /** Si fourni, charge le récap de cet utilisateur (admin). Sinon, l'utilisateur courant. */
  initialSummary?: AiUsageSummary;
  /** Permet de re-rendre quand un appel externe modifie l'usage (ex: génération réussie). */
  refreshKey?: number;
}

export function AiUsageRecap({ initialSummary, refreshKey }: Props) {
  const [summary, setSummary] = useState<AiUsageSummary | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(!initialSummary);

  useEffect(() => {
    if (initialSummary && refreshKey === undefined) {
      setSummary(initialSummary);
      return;
    }
    let cancelled = false;
    setLoading(true);
    ai.usage()
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch(() => { if (!cancelled) setSummary(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey, initialSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-ink-300">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!summary) {
    return <p className="text-sm text-ink-300">Impossible de charger l'usage IA.</p>;
  }

  return (
    <div className="space-y-3">
      {summary.features.map((f) => (
        <FeatureRow key={f.feature} usage={f} />
      ))}
      <p className="text-xs text-ink-200 mt-2">
        Quotas calculés sur une fenêtre glissante de 7&nbsp;jours.
        {summary.hasOverride && <span className="ml-1 text-bordeaux-500">Limites personnalisées appliquées.</span>}
      </p>
    </div>
  );
}

function FeatureRow({ usage }: { usage: AiFeatureUsage }) {
  const def = AI_FEATURES[usage.feature];
  const remaining = Math.max(0, usage.limit - usage.used);
  const pct = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const isFull = remaining === 0;

  return (
    <div className="bg-parchment-100 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-bordeaux-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-500 truncate">{def?.label ?? usage.feature}</p>
            {def?.description && <p className="text-xs text-ink-200 truncate">{def.description}</p>}
          </div>
        </div>
        <span className={`text-sm font-mono shrink-0 ${isFull ? 'text-red-500' : 'text-ink-400'}`}>
          {usage.used} / {usage.limit}
        </span>
      </div>
      <div className="mt-2 h-1.5 bg-parchment-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isFull ? 'bg-red-400' : 'bg-bordeaux-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {usage.nextAvailableAt && (
        <p className="text-xs text-ink-300 mt-1.5">
          Prochain crédit disponible {formatRelative(usage.nextAvailableAt)}
        </p>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = then - Date.now();
  if (diff <= 0) return "à l'instant";
  const hours = Math.round(diff / (1000 * 60 * 60));
  if (hours < 24) return `dans ${hours} h`;
  const days = Math.round(hours / 24);
  return `dans ${days} j`;
}
