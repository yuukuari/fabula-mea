import { useMemo, useState } from 'react';
import { Target, Layers, BookOpen, CheckCircle, TrendingUp, HelpCircle, BookMarked, Settings2, X, Info, Timer } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  getOverallProgress, getCompletedScenesCount,
  getBookType, getPageEstimate, estimateFromScenes, BOOK_TYPE_THRESHOLDS,
} from '@/lib/calculations';
import { cn, formatWritingTime } from '@/lib/utils';
import type { GoalMode } from '@/types';

export function ProgressionPage() {
  const scenes = useBookStore((s) => s.scenes);
  const goals = useBookStore((s) => s.goals);
  const updateGoals = useBookStore((s) => s.updateGoals);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const dailySnapshots = useBookStore((s) => s.dailySnapshots);

  const unitLabel = countUnit === 'characters' ? 'signes' : 'mots';
  const unitLabelCap = countUnit === 'characters' ? 'Signes' : 'Mots';

  // Total writing time across all snapshots
  const totalWritingMinutes = useMemo(() =>
    dailySnapshots.reduce((sum, s) => sum + (s.writingMinutesToday ?? 0), 0),
    [dailySnapshots]
  );

  const overallProgress = getOverallProgress(scenes, goals);
  const completedScenes = getCompletedScenesCount(scenes);
  const totalWords = scenes.reduce((sum, s) => sum + s.currentWordCount, 0);

  // Scene status breakdown
  const outlineCount = scenes.filter((s) => s.status === 'outline').length;
  const draftCount = scenes.filter((s) => s.status === 'draft').length;
  const revisionCount = scenes.filter((s) => s.status === 'revision').length;
  const completeCount = scenes.filter((s) => s.status === 'complete').length;

  // Estimations based on mode
  const estimation = useMemo(() => {
    if (goals.mode === 'total' && goals.targetTotalCount && goals.targetTotalCount > 0) {
      const perScene = scenes.length > 0 ? Math.round(goals.targetTotalCount / scenes.length) : 0;
      return {
        totalWords: goals.targetTotalCount,
        perScene,
        bookType: getBookType(goals.targetTotalCount, countUnit),
        source: 'target' as const,
      };
    }
    if (goals.mode === 'perScene' && goals.targetCountPerScene && goals.targetCountPerScene > 0) {
      const total = goals.targetCountPerScene * scenes.length;
      return {
        totalWords: total,
        perScene: goals.targetCountPerScene,
        bookType: getBookType(total, countUnit),
        source: 'target' as const,
      };
    }
    // Mode 'none' — estimate from written scenes
    const est = estimateFromScenes(scenes);
    if (est.estimatedTotal > 0) {
      return {
        totalWords: est.estimatedTotal,
        perScene: est.estimatedPerScene,
        bookType: getBookType(est.estimatedTotal, countUnit),
        completedCount: est.completedCount,
        source: 'estimated' as const,
      };
    }
    return null;
  }, [goals, scenes, countUnit]);

  return (
    <div className="page-container">
      <h2 className="section-title mb-6">Progression</h2>

      {scenes.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Pas de scènes"
          description="Créez des chapitres et des scènes dans l'onglet Chapitres pour commencer à suivre votre progression."
        />
      ) : (
        <div className="space-y-6">
          {/* Section 1: Progress + Scene Status — side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overall Progress */}
            <div className="card-fantasy p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold text-ink-500">Progression globale</h3>
                <span className="text-2xl font-display font-bold text-bordeaux-500">
                  {Math.round(overallProgress * 100)}%
                </span>
              </div>
              <div className="h-4 bg-parchment-200 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-bordeaux-500 to-gold-400 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress * 100}%` }}
                />
              </div>
              <p className="text-sm text-ink-300 mb-4">
                {goals.mode === 'total' && goals.targetTotalCount ? (
                  <>{totalWords.toLocaleString('fr-FR')} / {goals.targetTotalCount.toLocaleString('fr-FR')} {unitLabel}</>
                ) : goals.mode === 'perScene' ? (
                  <>{(overallProgress * scenes.length).toFixed(1)} / {scenes.length} scènes</>
                ) : (
                  <>{completedScenes} / {scenes.length} scènes terminées</>
                )}
              </p>

              <div className={cn('grid gap-4', totalWritingMinutes > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
                <StatCard icon={CheckCircle} label="Scènes terminées" value={`${completedScenes}/${scenes.length}`} />
                <StatCard icon={TrendingUp} label={`${unitLabelCap} écrits`} value={totalWords.toLocaleString('fr-FR')} />
                <div className="text-center">
                  <BookOpen className="w-5 h-5 text-gold-500 mx-auto mb-1" />
                  <div className="text-lg font-bold text-ink-500">{getPageEstimate(totalWords, countUnit)}</div>
                  <div className="text-xs text-ink-200 flex items-center justify-center gap-0.5">Pages estimées <PageInfoTip /></div>
                </div>
                {totalWritingMinutes > 0 && (
                  <StatCard
                    icon={Timer}
                    label="Temps d'écriture"
                    value={formatWritingTime(totalWritingMinutes)}
                  />
                )}
              </div>
            </div>

            {/* Scene Status Detail */}
            {scenes.length > 0 && (
              <div className="card-fantasy p-6">
                <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">Statut des scènes</h3>
                <div className="flex items-center gap-6">
                  <SceneStatusPie
                    outline={outlineCount}
                    draft={draftCount}
                    revision={revisionCount}
                    complete={completeCount}
                    total={scenes.length}
                  />
                  <div className="flex-1 space-y-2">
                    {[
                      { label: 'Plan', count: outlineCount, color: 'bg-ink-200', textColor: 'text-ink-300' },
                      { label: 'Brouillon', count: draftCount, color: 'bg-amber-400', textColor: 'text-amber-600' },
                      { label: 'Révision', count: revisionCount, color: 'bg-blue-400', textColor: 'text-blue-600' },
                      { label: 'Terminé', count: completeCount, color: 'bg-green-500', textColor: 'text-green-600' },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${s.color} shrink-0`} />
                        <span className="text-sm text-ink-400 flex-1">{s.label}</span>
                        <span className={cn('text-sm font-bold tabular-nums', s.textColor)}>{s.count}</span>
                        <span className="text-xs text-ink-200 w-10 text-right tabular-nums">
                          {scenes.length > 0 ? Math.round((s.count / scenes.length) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Ideal Book — condensed summary */}
          <IdealBookCard
            goals={goals}
            updateGoals={updateGoals}
            estimation={estimation}
            unitLabel={unitLabel}
            countUnit={countUnit}
            scenesCount={scenes.length}
          />
        </div>
      )}
    </div>
  );
}

// ─── Ideal Book Card (condensed) + Modal ───

function IdealBookCard({
  goals,
  updateGoals,
  estimation,
  unitLabel,
  countUnit,
  scenesCount,
}: {
  goals: { mode: GoalMode; targetTotalCount?: number; targetCountPerScene?: number };
  updateGoals: (data: Partial<{ mode: GoalMode; targetTotalCount?: number; targetCountPerScene?: number }>) => void;
  estimation: {
    totalWords: number;
    perScene: number;
    bookType: { label: string; pages: number };
    source: 'target' | 'estimated';
    completedCount?: number;
  } | null;
  unitLabel: string;
  countUnit: 'words' | 'characters';
  scenesCount: number;
}) {
  const [showModal, setShowModal] = useState(false);
  const unitLabelCap = countUnit === 'characters' ? 'Signes' : 'Mots';

  // Summary parts
  const modeName = goals.mode === 'total'
    ? `${(goals.targetTotalCount ?? 0).toLocaleString('fr-FR')} ${unitLabel} au total`
    : goals.mode === 'perScene'
      ? `${(goals.targetCountPerScene ?? 0).toLocaleString('fr-FR')} ${unitLabel}/scène`
      : 'Je ne sais pas encore';

  return (
    <>
      <div className="card-fantasy p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              estimation ? 'bg-gold-100 text-gold-600' : 'bg-parchment-200 text-ink-300'
            )}>
              <BookMarked className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold text-ink-500">Longueur du livre</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-ink-300">{modeName}</span>
                {estimation && (
                  <>
                    <span className="text-ink-200">·</span>
                    <span className="text-xs font-medium text-ink-400">
                      {estimation.bookType.label}
                    </span>
                    {estimation.source === 'estimated' && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                        Estimation
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-ghost flex items-center gap-1.5 text-sm shrink-0"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Configurer</span>
          </button>
        </div>

        {/* Estimation stats */}
        {estimation && (
          <div className="mt-3 pt-3 border-t border-parchment-200 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-ink-200 uppercase tracking-wider">
                {estimation.source === 'estimated' ? `${unitLabelCap} estimés` : `${unitLabelCap} au total`}
              </p>
              <p className="text-sm font-semibold text-ink-500 mt-0.5">
                {estimation.source === 'estimated' ? '~' : ''}{estimation.totalWords.toLocaleString('fr-FR')}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-ink-200 uppercase tracking-wider flex items-center gap-1">
                Pages estimées <PageInfoTip />
              </p>
              <p className="text-sm font-semibold text-ink-500 mt-0.5">
                ~{estimation.bookType.pages}
              </p>
            </div>
            {scenesCount > 0 && (
              <div>
                <p className="text-[11px] text-ink-200 uppercase tracking-wider">
                  {unitLabelCap}/scène
                </p>
                <p className="text-sm font-semibold text-ink-500 mt-0.5">
                  {goals.mode !== 'perScene' ? '~' : ''}{estimation.perScene.toLocaleString('fr-FR')}
                </p>
              </div>
            )}
          </div>
        )}

        {goals.mode === 'none' && !estimation && (
          <p className="mt-3 pt-3 border-t border-parchment-200 text-xs text-ink-200 italic">
            Commencez à écrire vos scènes pour obtenir une estimation.
          </p>
        )}

        {/* Book type scale */}
        {estimation && <BookTypeScale currentCount={estimation.totalWords} countUnit={countUnit} />}
      </div>

      {showModal && (
        <IdealBookModal
          goals={goals}
          updateGoals={updateGoals}
          unitLabel={unitLabel}
          countUnit={countUnit}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function IdealBookModal({
  goals,
  updateGoals,
  unitLabel,
  countUnit,
  onClose,
}: {
  goals: { mode: GoalMode; targetTotalCount?: number; targetCountPerScene?: number };
  updateGoals: (data: Partial<{ mode: GoalMode; targetTotalCount?: number; targetCountPerScene?: number }>) => void;
  unitLabel: string;
  countUnit: 'words' | 'characters';
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-bold text-ink-500">Longueur du livre</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-ink-300 mb-5">
          Quelle taille souhaitez-vous pour votre livre ? Cette estimation sert à calculer les objectifs par scène et vos objectifs d'écriture.
        </p>

        <GoalModeSelector
          mode={goals.mode}
          countUnit={countUnit}
          onChange={(mode) => updateGoals({ mode })}
        />

        {goals.mode === 'total' && (
          <div className="mt-4">
            <label className="label-field">Nombre total de {unitLabel} visé</label>
            <input
              type="number"
              value={goals.targetTotalCount ?? ''}
              onChange={(e) => updateGoals({ targetTotalCount: e.target.value ? Number(e.target.value) : undefined })}
              className="input-field"
              min={1}
              placeholder={countUnit === 'characters' ? 'ex: 300 000' : 'ex: 80 000'}
            />
            {goals.targetTotalCount != null && goals.targetTotalCount > 0 && (
              <p className="text-xs text-ink-300 mt-1.5 flex items-center gap-1">
                ~{getPageEstimate(goals.targetTotalCount, countUnit)} pages estimées
                <PageInfoTip />
              </p>
            )}
          </div>
        )}
        {goals.mode === 'perScene' && (
          <div className="mt-4">
            <label className="label-field">Nombre de {unitLabel} par scène</label>
            <input
              type="number"
              value={goals.targetCountPerScene ?? ''}
              onChange={(e) => updateGoals({ targetCountPerScene: e.target.value ? Number(e.target.value) : undefined })}
              className="input-field"
              min={1}
              placeholder={countUnit === 'characters' ? 'ex: 5 000' : 'ex: 1 500'}
            />
            {goals.targetCountPerScene != null && goals.targetCountPerScene > 0 && (
              <p className="text-xs text-ink-300 mt-1.5 flex items-center gap-1">
                ~{getPageEstimate(goals.targetCountPerScene, countUnit)} pages/scène
                <PageInfoTip />
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end mt-6 pt-4 border-t border-parchment-200">
          <button onClick={onClose} className="btn-primary">Fermer</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="text-center">
      <Icon className="w-5 h-5 text-gold-500 mx-auto mb-1" />
      <div className="text-lg font-bold text-ink-500">{value}</div>
      <div className="text-xs text-ink-200">{label}</div>
    </div>
  );
}

/** Small (i) tooltip indicating page estimates are for "livre de poche" format */
function PageInfoTip() {
  return (
    <span className="relative group/tip inline-flex items-center">
      <Info className="w-3 h-3 text-ink-200 cursor-help" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] text-white bg-ink-500 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">
        Estimation format livre de poche
      </span>
    </span>
  );
}

function GoalModeSelector({
  mode,
  countUnit,
  onChange,
}: {
  mode: GoalMode;
  countUnit: 'words' | 'characters';
  onChange: (mode: GoalMode) => void;
}) {
  const unitLabel = countUnit === 'characters' ? 'signes' : 'mots';
  const options: { value: GoalMode; icon: React.ComponentType<{ className?: string }>; title: string; description: string }[] = [
    {
      value: 'total',
      icon: Target,
      title: `Un nombre de ${unitLabel}`,
      description: `Je vise un nombre total de ${unitLabel} pour mon livre.`,
    },
    {
      value: 'perScene',
      icon: Layers,
      title: `Des ${unitLabel} par scène`,
      description: `Je vise un nombre de ${unitLabel} par scène.`,
    },
    {
      value: 'none',
      icon: HelpCircle,
      title: 'Je ne sais pas',
      description: 'La taille de mon livre sera estimée au fur et à mesure de l\'écriture.',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {options.map(({ value, icon: Icon, title, description }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
            mode === value
              ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200 cursor-default'
              : 'border-parchment-200 hover:border-parchment-400 cursor-pointer'
          )}
        >
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            mode === value ? 'bg-bordeaux-100' : 'bg-parchment-200'
          )}>
            <Icon className={cn('w-5 h-5', mode === value ? 'text-bordeaux-500' : 'text-ink-300')} />
          </div>
          <div>
            <p className="font-display font-semibold text-ink-500 text-sm">{title}</p>
            <p className="text-xs text-ink-300 mt-1 leading-relaxed">{description}</p>
            {mode === value && (
              <span className="inline-block mt-1.5 text-[10px] bg-bordeaux-100 text-bordeaux-600 px-1.5 py-0.5 rounded-full font-medium">
                Choix actuel
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

/** SVG donut/pie chart for scene statuses */
function SceneStatusPie({
  outline,
  draft,
  revision,
  complete,
  total,
}: {
  outline: number;
  draft: number;
  revision: number;
  complete: number;
  total: number;
}) {
  if (total === 0) return null;

  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = 44;
  const strokeWidth = 16;

  const segments = [
    { count: complete, color: '#22c55e' },
    { count: revision, color: '#60a5fa' },
    { count: draft, color: '#fbbf24' },
    { count: outline, color: '#c4b5a0' },
  ].filter((s) => s.count > 0);

  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f5ede1" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          const pct = seg.count / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const currentOffset = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
        })}
        {/* Center text */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontWeight="bold" fill="#3d3129">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="#8c7b6b">
          scènes
        </text>
      </svg>
    </div>
  );
}

/** Visual scale showing where the current book falls in the typology, with cursor */
function BookTypeScale({ currentCount, countUnit }: { currentCount: number; countUnit: 'words' | 'characters' }) {
  const isChars = countUnit === 'characters';
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

  // Build segments from thresholds + last open-ended segment
  const segments = [
    ...BOOK_TYPE_THRESHOLDS.map((t, i) => ({
      label: t.label,
      min: i === 0 ? 0 : (isChars ? BOOK_TYPE_THRESHOLDS[i - 1].maxChars : BOOK_TYPE_THRESHOLDS[i - 1].maxWords),
      max: isChars ? t.maxChars : t.maxWords,
    })),
    {
      label: 'Très long roman',
      min: isChars
        ? BOOK_TYPE_THRESHOLDS[BOOK_TYPE_THRESHOLDS.length - 1].maxChars
        : BOOK_TYPE_THRESHOLDS[BOOK_TYPE_THRESHOLDS.length - 1].maxWords,
      max: isChars
        ? BOOK_TYPE_THRESHOLDS[BOOK_TYPE_THRESHOLDS.length - 1].maxChars * 1.5
        : BOOK_TYPE_THRESHOLDS[BOOK_TYPE_THRESHOLDS.length - 1].maxWords * 1.5,
    },
  ];

  const totalMax = segments[segments.length - 1].max;
  const clampedCount = Math.min(Math.max(currentCount, 0), totalMax);
  const cursorPct = (clampedCount / totalMax) * 100;

  return (
    <div className="mt-3 pt-3 border-t border-parchment-200">
      <div className="flex items-center gap-1 mb-2">
        <p className="text-[10px] text-ink-200">Catégorie du livre</p>
      </div>
      {/* Track with segments */}
      <div className="relative">
        <div className="flex gap-px h-2 rounded-full overflow-hidden">
          {segments.map((t, i) => {
            const isActive = i === 0
              ? currentCount <= t.max
              : currentCount > segments[i - 1].max && currentCount <= t.max
                ? true
                : i === segments.length - 1 && currentCount > segments[i - 1].max;
            return (
              <div
                key={t.label}
                className={cn(
                  'transition-colors',
                  isActive ? 'bg-bordeaux-400' : 'bg-parchment-300'
                )}
                style={{ flex: `${t.max - t.min} 0 0%` }}
              />
            );
          })}
        </div>
        {/* Cursor */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300"
          style={{ left: `${cursorPct}%` }}
        >
          <div className="w-4 h-4 rounded-full bg-bordeaux-500 border-2 border-white shadow-md" />
        </div>
      </div>

      {/* Labels + ranges */}
      <div className="flex mt-1.5">
        {segments.map((t, i) => {
          const isActive = i === 0
            ? currentCount <= t.max
            : currentCount > segments[i - 1].max && currentCount <= t.max
              ? true
              : i === segments.length - 1 && currentCount > segments[i - 1].max;
          const range = i === 0
            ? `< ${fmt(t.max)}`
            : i === segments.length - 1
              ? `> ${fmt(t.min)}`
              : `${fmt(t.min)}–${fmt(t.max)}`;
          return (
            <div
              key={t.label}
              className="text-center"
              style={{ flex: `${t.max - t.min} 0 0%` }}
            >
              <p className={cn(
                'text-[10px] leading-tight',
                isActive ? 'text-bordeaux-500 font-semibold' : 'text-ink-200'
              )}>
                {t.label}
              </p>
              <p className={cn(
                'text-[9px] leading-tight',
                isActive ? 'text-bordeaux-400' : 'text-ink-100'
              )}>
                {range}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
