import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, ChevronRight } from 'lucide-react';
import type { ConformityCheck, ConformityStatus } from '@/lib/conformity';
import { summarizeConformity } from '@/lib/conformity';

interface Props {
  checks: ConformityCheck[];
}

const CATEGORY_LABELS: Record<string, string> = {
  common: 'Général',
  print: 'Édition papier',
  digital: 'Édition numérique',
};

const STATUS_ICONS = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const;

const STATUS_COLORS: Record<ConformityStatus, { icon: string; bg: string; border: string }> = {
  pass: { icon: 'text-green-500', bg: 'bg-green-50/40', border: 'border-green-100' },
  warning: { icon: 'text-amber-500', bg: 'bg-amber-50/40', border: 'border-amber-100' },
  error: { icon: 'text-red-500', bg: 'bg-red-50/40', border: 'border-red-100' },
  info: { icon: 'text-blue-500', bg: 'bg-blue-50/40', border: 'border-blue-100' },
};

export function ConformityReport({ checks }: Props) {
  const navigate = useNavigate();
  const summary = summarizeConformity(checks);

  // Group by category
  const grouped = checks.reduce<Record<string, ConformityCheck[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  // Order: common, print, digital
  const orderedCategories = ['common', 'print', 'digital'].filter((c) => grouped[c]);

  return (
    <div className="card-fantasy p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-500">Rapport de conformité</h3>
          <p className="text-sm text-ink-300 mt-0.5">
            Vérifications automatiques avant export. Les erreurs doivent être corrigées, les avertissements sont des recommandations.
          </p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-parchment-50 mb-5">
        <SummaryBadge count={summary.passes} label="OK" status="pass" />
        {summary.errors > 0 && <SummaryBadge count={summary.errors} label={summary.errors > 1 ? 'erreurs' : 'erreur'} status="error" />}
        {summary.warnings > 0 && <SummaryBadge count={summary.warnings} label={summary.warnings > 1 ? 'avertissements' : 'avertissement'} status="warning" />}
        {summary.infos > 0 && <SummaryBadge count={summary.infos} label={summary.infos > 1 ? 'infos' : 'info'} status="info" />}
        <div className="flex-1" />
        {summary.readyToExport ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Prêt pour l'export
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            <XCircle className="w-3.5 h-3.5" />
            Erreurs à corriger
          </span>
        )}
      </div>

      {/* Grouped checks */}
      <div className="space-y-5">
        {orderedCategories.map((cat) => (
          <div key={cat}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-300 mb-2">
              {CATEGORY_LABELS[cat]}
            </h4>
            <div className="space-y-2">
              {grouped[cat].map((check) => {
                const Icon = STATUS_ICONS[check.status];
                const colors = STATUS_COLORS[check.status];
                return (
                  <div
                    key={check.id}
                    className={`p-3 rounded-lg border ${colors.border} ${colors.bg}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${colors.icon}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-medium text-ink-500 text-sm">{check.title}</p>
                          {check.action && (
                            <button
                              onClick={() => navigate(check.action!.to)}
                              className="text-xs text-bordeaux-400 hover:text-bordeaux-600 font-medium whitespace-nowrap flex items-center gap-0.5 shrink-0"
                            >
                              {check.action.label}
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-ink-400 mt-0.5">{check.message}</p>
                        {check.solution && (
                          <p className="text-xs text-ink-300 mt-1.5 italic">{check.solution}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryBadge({ count, label, status }: { count: number; label: string; status: ConformityStatus }) {
  const colors = STATUS_COLORS[status];
  const Icon = STATUS_ICONS[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Icon className={`w-4 h-4 ${colors.icon}`} />
      <span className="font-semibold text-ink-500">{count}</span>
      <span className="text-ink-300">{label}</span>
    </span>
  );
}
