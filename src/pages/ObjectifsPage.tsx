import { useState, useMemo } from 'react';
import { Target, Plus, Trash2, CheckCircle, X, Coffee, Pen, Timer, Settings2, CalendarClock, CalendarOff, Palmtree } from 'lucide-react';
import { format, parseISO, differenceInDays, eachDayOfInterval, startOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  getWorkingDaysRemaining, getDailyGoal, getDaysUntilDeadline,
  isTodayExcluded, getTodayProgress, isDateExcluded,
} from '@/lib/calculations';
import { cn, formatWritingTime } from '@/lib/utils';
import type { DailySnapshot, ExcludedPeriod, ObjectiveType, ProjectGoals } from '@/types';

export function ObjectifsPage() {
  const scenes = useBookStore((s) => s.scenes);
  const goals = useBookStore((s) => s.goals);
  const updateGoals = useBookStore((s) => s.updateGoals);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const bookId = useBookStore((s) => s.id);
  const dailySnapshots = useBookStore((s) => s.dailySnapshots);
  const addExcludedPeriod = useBookStore((s) => s.addExcludedPeriod);
  const deleteExcludedPeriod = useBookStore((s) => s.deleteExcludedPeriod);

  const [showObjectiveEditor, setShowObjectiveEditor] = useState(false);

  const unitLabel = countUnit === 'characters' ? 'signes' : 'mots';

  const totalWords = scenes.reduce((sum, s) => sum + s.currentWordCount, 0);
  const daysUntilDeadline = getDaysUntilDeadline(goals);
  const workingDays = getWorkingDaysRemaining(goals);

  // Daily progress tracking
  const computedDailyGoal = getDailyGoal(scenes, goals);
  const { todayCount } = getTodayProgress(bookId, totalWords);
  const todayExcluded = isTodayExcluded(goals);
  const dailyGoalReached = computedDailyGoal != null && computedDailyGoal > 0 && todayCount >= computedDailyGoal;

  const hasBookTarget = (goals.mode === 'total' && !!goals.targetTotalCount && goals.targetTotalCount > 0)
    || (goals.mode === 'perScene' && !!goals.targetCountPerScene && goals.targetCountPerScene > 0);

  // Time objective summary
  const timeObj = goals.timeObjective ?? {};
  const timeLabels: string[] = [];
  if (timeObj.hoursPerDay) timeLabels.push(`${timeObj.hoursPerDay}h/jour`);
  if (timeObj.hoursPerWeek) timeLabels.push(`${timeObj.hoursPerWeek}h/semaine`);
  if (timeObj.hoursPerMonth) timeLabels.push(`${timeObj.hoursPerMonth}h/mois`);

  // Writing minutes from snapshots
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todaySnapshot = dailySnapshots.find((s) => s.date === todayDateStr);
  const writingMinutesToday = todaySnapshot?.writingMinutesToday ?? 0;

  return (
    <div className="page-container">
      <h2 className="section-title mb-6">Objectifs</h2>

      {scenes.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Pas de scènes"
          description="Créez des chapitres et des scènes pour commencer à vous fixer des objectifs d'écriture."
        />
      ) : (
        <div className="space-y-6">
          {/* Section 1: Today's progress — always visible */}
          <TodayBlock
            goals={goals}
            todayExcluded={todayExcluded}
            todayCount={todayCount}
            computedDailyGoal={computedDailyGoal}
            dailyGoalReached={dailyGoalReached}
            unitLabel={unitLabel}
            writingMinutesToday={writingMinutesToday}
            dailySnapshots={dailySnapshots}
          />

          {/* Section 2: Objective + Excluded Periods — side by side on lg */}
          <div className={cn(
            'grid gap-6',
            goals.objectiveEnabled ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          )}>
            {/* Objective config card */}
            <div className="card-fantasy p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    goals.objectiveEnabled ? 'bg-bordeaux-100 text-bordeaux-500' : 'bg-parchment-200 text-ink-300'
                  )}>
                    <Target className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-semibold text-ink-500">
                      {goals.objectiveEnabled ? 'Objectif d\'écriture actif' : 'Pas d\'objectif d\'écriture'}
                    </h3>
                    {!goals.objectiveEnabled && (
                      <p className="text-xs text-ink-300 mt-0.5">Activez un objectif pour suivre votre progression quotidienne.</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowObjectiveEditor(true)}
                  className="btn-ghost flex items-center gap-1.5 text-sm shrink-0"
                >
                  <Settings2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Configurer</span>
                </button>
              </div>

              {goals.objectiveEnabled && (
                <ObjectiveSummaryBlock
                  goals={goals}
                  unitLabel={unitLabel}
                  computedDailyGoal={computedDailyGoal}
                  daysUntilDeadline={daysUntilDeadline}
                  workingDays={workingDays}
                  timeLabels={timeLabels}
                />
              )}
            </div>

            {/* Excluded Periods card — condensed */}
            {goals.objectiveEnabled && (
              <ExcludedPeriodsCard
                goals={goals}
                addExcludedPeriod={addExcludedPeriod}
                deleteExcludedPeriod={deleteExcludedPeriod}
                todayExcluded={todayExcluded}
              />
            )}
          </div>

          {/* Section 4: Progress Chart */}
          {goals.objectiveEnabled && goals.objectiveType !== 'time' && goals.targetEndDate && dailySnapshots.length > 0 && (
            <div className="card-fantasy p-6">
              <h3 className="font-display text-base font-semibold text-ink-500 mb-4">Courbe de progression</h3>
              <ProgressChart
                dailySnapshots={dailySnapshots}
                goals={goals}
                scenes={scenes}
                countUnit={countUnit}
              />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showObjectiveEditor && (
        <ObjectiveEditorModal
          goals={goals}
          updateGoals={updateGoals}
          unitLabel={unitLabel}
          hasBookTarget={hasBookTarget}
          onClose={() => setShowObjectiveEditor(false)}
        />
      )}
    </div>
  );
}

// ─── Today Block ───

function TodayBlock({
  goals,
  todayExcluded,
  todayCount,
  computedDailyGoal,
  dailyGoalReached,
  unitLabel,
  writingMinutesToday,
  dailySnapshots,
}: {
  goals: ProjectGoals;
  todayExcluded: boolean;
  todayCount: number;
  computedDailyGoal: number | null;
  dailyGoalReached: boolean;
  unitLabel: string;
  writingMinutesToday: number;
  dailySnapshots: DailySnapshot[];
}) {
  // Excluded day
  if (todayExcluded && goals.objectiveEnabled) {
    return (
      <div className="card-fantasy p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-parchment-200 flex items-center justify-center">
            <Coffee className="w-6 h-6 text-ink-300" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-500">Jour de repos</h3>
            <p className="text-sm text-ink-300">
              Cette journée fait partie d'une période exclue. Votre objectif est à 0 aujourd'hui.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Time-based objective
  if (goals.objectiveEnabled && goals.objectiveType === 'time') {
    const timeObj = goals.timeObjective ?? {};
    const dailyTargetMinutes = timeObj.hoursPerDay ? timeObj.hoursPerDay * 60 : 0;
    const weeklyTargetMinutes = timeObj.hoursPerWeek ? timeObj.hoursPerWeek * 60 : 0;
    const monthlyTargetMinutes = timeObj.hoursPerMonth ? timeObj.hoursPerMonth * 60 : 0;

    // Compute weekly writing minutes (Mon–Sun of current week)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    const mondayStr = monday.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const weekMinutes = dailySnapshots
      .filter((s) => s.date >= mondayStr && s.date <= todayStr)
      .reduce((sum, s) => sum + (s.writingMinutesToday ?? 0), 0);

    // Compute monthly writing minutes (1st–today of current month)
    const monthStart = todayStr.slice(0, 8) + '01';
    const monthMinutes = dailySnapshots
      .filter((s) => s.date >= monthStart && s.date <= todayStr)
      .reduce((sum, s) => sum + (s.writingMinutesToday ?? 0), 0);

    // Build cards: today is always shown, week/month only if target set
    const cards: { title: string; current: number; target: number | null }[] = [];
    cards.push({ title: "Aujourd'hui", current: writingMinutesToday, target: dailyTargetMinutes > 0 ? dailyTargetMinutes : null });
    if (weeklyTargetMinutes > 0) cards.push({ title: 'Cette semaine', current: weekMinutes, target: weeklyTargetMinutes });
    if (monthlyTargetMinutes > 0) cards.push({ title: 'Ce mois', current: monthMinutes, target: monthlyTargetMinutes });

    const cols = cards.length === 1 ? 'grid-cols-1' : cards.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3';

    return (
      <div className={cn('grid gap-4', cols)}>
        {cards.map((card) => {
          const hasTarget = card.target != null && card.target > 0;
          const pct = hasTarget ? Math.min(100, Math.round((card.current / card.target!) * 100)) : 0;
          const reached = hasTarget && card.current >= card.target!;
          return (
            <div
              key={card.title}
              className={cn(
                'card-fantasy p-5',
                reached ? 'border-2 border-green-300 bg-green-50/20' : ''
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-semibold text-ink-500">{card.title}</h3>
                {reached && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>
              <p className="text-2xl font-display font-bold text-ink-500 mb-2">
                {formatWritingTime(card.current)}
                {hasTarget && (
                  <span className="text-sm font-normal text-ink-300 ml-2">
                    / {formatWritingTime(card.target!)}
                  </span>
                )}
                {!hasTarget && (
                  <span className="text-sm font-normal text-ink-300 ml-2">d'écriture</span>
                )}
              </p>
              {hasTarget && (
                <div className="h-2.5 bg-parchment-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      reached ? 'bg-green-500' : 'bg-bordeaux-400'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              {card.title === "Aujourd'hui" && (
                <p className="text-sm text-ink-300 mt-3">
                  <span className="font-medium text-ink-500">{todayCount.toLocaleString('fr-FR')} {unitLabel}</span> écrits
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Word-based objective with a goal
  const effectiveGoal = computedDailyGoal ?? (goals.objectiveEnabled ? goals.manualDailyGoal : null);

  if (goals.objectiveEnabled && effectiveGoal && effectiveGoal > 0) {
    const pct = Math.min(100, (todayCount / effectiveGoal) * 100);
    return (
      <div className={cn(
        'card-fantasy p-5 border-2',
        dailyGoalReached ? 'border-green-300 bg-green-50/20' : ''
      )}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold text-ink-500">Aujourd'hui</h3>
          {dailyGoalReached && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
              <CheckCircle className="w-4 h-4" /> Objectif atteint !
            </span>
          )}
        </div>
        <p className="text-2xl font-display font-bold text-ink-500 mb-2">
          {todayCount.toLocaleString('fr-FR')}
          <span className="text-sm font-normal text-ink-300 ml-2">
            / {effectiveGoal.toLocaleString('fr-FR')} {unitLabel}
          </span>
        </p>
        <div className="h-3 bg-parchment-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              dailyGoalReached ? 'bg-green-500' : 'bg-bordeaux-400'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // No objective or not configured
  return (
    <div className="card-fantasy p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-500">Aujourd'hui</h3>
          <p className="text-sm text-ink-300 mt-0.5">
            <span className="font-medium text-ink-500">{todayCount.toLocaleString('fr-FR')} {unitLabel}</span> écrits
          </p>
        </div>
        {!goals.objectiveEnabled && (
          <p className="text-xs text-ink-200 max-w-48 text-right">
            Activez un objectif d'écriture pour suivre votre avancement quotidien.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Objective Summary Block (larger display below header) ───

function ObjectiveSummaryBlock({
  goals,
  unitLabel,
  computedDailyGoal,
  daysUntilDeadline,
  workingDays,
  timeLabels,
}: {
  goals: ProjectGoals;
  unitLabel: string;
  computedDailyGoal: number | null;
  daysUntilDeadline: number;
  workingDays: number;
  timeLabels: string[];
}) {
  const isTime = goals.objectiveType === 'time';
  const effectiveGoal = computedDailyGoal ?? goals.manualDailyGoal;

  // Build stat items
  const stats: { label: string; value: string; accent?: boolean }[] = [];

  if (isTime) {
    if (timeLabels.length > 0) {
      stats.push({ label: 'Objectif', value: timeLabels.join(', '), accent: true });
    }
  } else if (effectiveGoal && effectiveGoal > 0) {
    stats.push({ label: 'Objectif/jour', value: `${effectiveGoal.toLocaleString('fr-FR')} ${unitLabel}`, accent: true });
  }

  if (goals.targetEndDate) {
    if (daysUntilDeadline > 0) {
      stats.push({ label: 'Jours restants', value: `${workingDays} j. de travail` });
      stats.push({ label: 'Date cible', value: format(parseISO(goals.targetEndDate), 'dd MMM yyyy', { locale: fr }) });
    } else if (daysUntilDeadline === 0) {
      stats.push({ label: 'Date cible', value: 'Aujourd\'hui !' });
    } else {
      stats.push({ label: 'Date cible', value: `Dépassée de ${Math.abs(daysUntilDeadline)} j.`, accent: true });
    }
  } else {
    stats.push({ label: 'Date cible', value: 'Non définie' });
  }

  if (stats.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-parchment-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {stats.map((s) => (
        <div key={s.label}>
          <p className="text-[11px] text-ink-200 uppercase tracking-wider">{s.label}</p>
          <p className={cn(
            'text-sm font-semibold mt-0.5',
            s.accent ? 'text-bordeaux-500' : 'text-ink-500'
          )}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Objective Editor Modal ───

function ObjectiveEditorModal({
  goals,
  updateGoals,
  unitLabel,
  hasBookTarget,
  onClose,
}: {
  goals: ProjectGoals;
  updateGoals: (data: Partial<ProjectGoals>) => void;
  unitLabel: string;
  hasBookTarget: boolean;
  onClose: () => void;
}) {
  // Derive effective objectiveType (default to wordCount)
  const objType = goals.objectiveType ?? 'wordCount';
  const hasDate = !!goals.targetEndDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-bold text-ink-500">Objectif d'écriture</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-parchment-200">
          <p className="text-sm font-medium text-ink-500">Je me fixe un objectif d'écriture</p>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={goals.objectiveEnabled}
              onChange={(e) => updateGoals({ objectiveEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-parchment-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-bordeaux-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bordeaux-500" />
          </label>
        </div>

        {goals.objectiveEnabled && (
          <div className="space-y-5">
            {/* Objective type */}
            <div>
              <p className="text-sm font-medium text-ink-400 mb-3">Type d'objectif</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateGoals({ objectiveType: 'wordCount' })}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all',
                    objType === 'wordCount'
                      ? 'border-bordeaux-400 bg-bordeaux-50/50'
                      : 'border-parchment-200 hover:border-parchment-400'
                  )}
                >
                  <Pen className={cn('w-4 h-4', objType === 'wordCount' ? 'text-bordeaux-500' : 'text-ink-300')} />
                  <span className={cn('text-sm font-medium', objType === 'wordCount' ? 'text-bordeaux-600' : 'text-ink-400')}>
                    Nombre de {unitLabel}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => updateGoals({ objectiveType: 'time' })}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all',
                    objType === 'time'
                      ? 'border-bordeaux-400 bg-bordeaux-50/50'
                      : 'border-parchment-200 hover:border-parchment-400'
                  )}
                >
                  <Timer className={cn('w-4 h-4', objType === 'time' ? 'text-bordeaux-500' : 'text-ink-300')} />
                  <span className={cn('text-sm font-medium', objType === 'time' ? 'text-bordeaux-600' : 'text-ink-400')}>
                    Temps d'écriture
                  </span>
                </button>
              </div>
            </div>

            {/* Date choice — only for wordCount */}
            {objType === 'wordCount' && (
              <div>
                <p className="text-sm font-medium text-ink-400 mb-3">Date de fin</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!goals.targetEndDate) {
                        // Default to 3 months from now
                        const d = new Date();
                        d.setMonth(d.getMonth() + 3);
                        updateGoals({ targetEndDate: d.toISOString().split('T')[0] });
                      }
                    }}
                    className={cn(
                      'flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all',
                      hasDate
                        ? 'border-bordeaux-400 bg-bordeaux-50/50'
                        : 'border-parchment-200 hover:border-parchment-400'
                    )}
                  >
                    <CalendarClock className={cn('w-4 h-4 mt-0.5 shrink-0', hasDate ? 'text-bordeaux-500' : 'text-ink-300')} />
                    <div>
                      <p className={cn('text-sm font-medium', hasDate ? 'text-bordeaux-600' : 'text-ink-400')}>J'ai une date cible</p>
                      <p className="text-[11px] text-ink-200 mt-0.5 leading-snug">
                        {hasBookTarget
                          ? `Votre objectif de ${unitLabel}/jour sera calculé automatiquement.`
                          : `Vous pourrez fixer un objectif de ${unitLabel}/jour.`
                        }
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateGoals({ targetEndDate: undefined })}
                    className={cn(
                      'flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all',
                      !hasDate
                        ? 'border-bordeaux-400 bg-bordeaux-50/50'
                        : 'border-parchment-200 hover:border-parchment-400'
                    )}
                  >
                    <CalendarOff className={cn('w-4 h-4 mt-0.5 shrink-0', !hasDate ? 'text-bordeaux-500' : 'text-ink-300')} />
                    <div>
                      <p className={cn('text-sm font-medium', !hasDate ? 'text-bordeaux-600' : 'text-ink-400')}>Pas de date cible</p>
                      <p className="text-[11px] text-ink-200 mt-0.5 leading-snug">
                        Vous fixez vous-même votre objectif de {unitLabel} par jour.
                      </p>
                    </div>
                  </button>
                </div>

                {hasDate && (
                  <input
                    type="date"
                    value={goals.targetEndDate ?? ''}
                    onChange={(e) => updateGoals({ targetEndDate: e.target.value || undefined })}
                    className="input-field"
                  />
                )}
              </div>
            )}

            {/* Word count details */}
            {objType === 'wordCount' && (
              <div>
                {hasBookTarget && hasDate ? (
                  <p className="text-sm text-ink-300 bg-parchment-100 rounded-lg px-3 py-2">
                    L'objectif est recalculé chaque jour en fonction de votre avancement et du nombre de jours de travail restants.
                  </p>
                ) : (
                  <div>
                    <label className="label-field">Objectif journalier ({unitLabel}/jour)</label>
                    <input
                      type="number"
                      value={goals.manualDailyGoal ?? ''}
                      onChange={(e) => updateGoals({ manualDailyGoal: e.target.value ? Number(e.target.value) : undefined })}
                      className="input-field"
                      min={1}
                      placeholder={`ex: ${unitLabel === 'signes' ? '2 000' : '500'}`}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Time objective */}
            {objType === 'time' && (
              <TimeObjectiveFields goals={goals} updateGoals={updateGoals} />
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

function TimeObjectiveFields({
  goals,
  updateGoals,
}: {
  goals: ProjectGoals;
  updateGoals: (data: Partial<ProjectGoals>) => void;
}) {
  const timeObj = goals.timeObjective ?? {};
  const update = (field: string, value: number | undefined) => {
    updateGoals({
      timeObjective: { ...timeObj, [field]: value },
    });
  };

  return (
    <div>
      <p className="text-xs text-ink-300 mb-3">
        Remplissez au moins un champ. L'objectif est indépendant du nombre de mots visé.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label-field">Heures/jour</label>
          <input
            type="number"
            value={timeObj.hoursPerDay ?? ''}
            onChange={(e) => update('hoursPerDay', e.target.value ? Number(e.target.value) : undefined)}
            className="input-field"
            min={0.5}
            step={0.5}
            placeholder="2"
          />
        </div>
        <div>
          <label className="label-field">Heures/semaine</label>
          <input
            type="number"
            value={timeObj.hoursPerWeek ?? ''}
            onChange={(e) => update('hoursPerWeek', e.target.value ? Number(e.target.value) : undefined)}
            className="input-field"
            min={1}
            step={1}
            placeholder="10"
          />
        </div>
        <div>
          <label className="label-field">Heures/mois</label>
          <input
            type="number"
            value={timeObj.hoursPerMonth ?? ''}
            onChange={(e) => update('hoursPerMonth', e.target.value ? Number(e.target.value) : undefined)}
            className="input-field"
            min={1}
            step={1}
            placeholder="40"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Progress Chart ───

function ProgressChart({
  dailySnapshots,
  goals,
  scenes,
  countUnit,
}: {
  dailySnapshots: DailySnapshot[];
  goals: ProjectGoals;
  scenes: { currentWordCount: number }[];
  countUnit: 'words' | 'characters';
}) {
  const chartData = useMemo(() => {
    if (!goals.targetEndDate || goals.mode === 'none') return null;

    const targetTotal = goals.mode === 'total' && goals.targetTotalCount
      ? goals.targetTotalCount
      : goals.mode === 'perScene' && goals.targetCountPerScene
        ? goals.targetCountPerScene * scenes.length
        : 0;
    if (targetTotal <= 0) return null;

    const today = startOfDay(new Date());
    const endDate = startOfDay(parseISO(goals.targetEndDate));

    const sortedSnaps = [...dailySnapshots].sort((a, b) => a.date.localeCompare(b.date));
    const firstSnapDate = sortedSnaps.length > 0 ? startOfDay(parseISO(sortedSnaps[0].date)) : today;
    const thirtyBefore = new Date(endDate);
    thirtyBefore.setDate(thirtyBefore.getDate() - 30);
    const chartStart = firstSnapDate < thirtyBefore ? firstSnapDate : thirtyBefore;
    const chartEnd = endDate > today ? endDate : new Date(today.getTime() + 7 * 86400000);

    const allDays = eachDayOfInterval({ start: chartStart, end: chartEnd });

    const snapMap: Record<string, DailySnapshot> = {};
    for (const s of sortedSnaps) snapMap[s.date] = s;

    const realPoints: { date: Date; value: number }[] = [];
    for (const day of allDays) {
      if (day > today) break;
      const key = format(day, 'yyyy-MM-dd');
      const snap = snapMap[key];
      if (snap) {
        realPoints.push({ date: day, value: snap.totalWritten });
      } else if (realPoints.length > 0) {
        realPoints.push({ date: day, value: realPoints[realPoints.length - 1].value });
      }
    }

    const currentTotal = scenes.reduce((sum, s) => sum + s.currentWordCount, 0);
    if (realPoints.length === 0 || realPoints[realPoints.length - 1].date < today) {
      realPoints.push({ date: today, value: currentTotal });
    } else {
      realPoints[realPoints.length - 1].value = currentTotal;
    }

    const projectedPoints: { date: Date; value: number }[] = [{ date: today, value: currentTotal }];
    let projectedTotal = currentTotal;
    const remaining = Math.max(0, targetTotal - currentTotal);
    const futureDays = allDays.filter((d) => d > today);
    const futureWorkingDays = futureDays.filter((d) => !isDateExcluded(d, goals.excludedPeriods));
    const dailyRate = futureWorkingDays.length > 0 ? remaining / futureWorkingDays.length : 0;

    for (const day of futureDays) {
      const excluded = isDateExcluded(day, goals.excludedPeriods);
      if (!excluded) {
        projectedTotal += dailyRate;
      }
      projectedPoints.push({ date: day, value: Math.min(projectedTotal, targetTotal) });
    }

    // Ideal pace — segmented by goal changes
    type GoalPeriod = { startDate: Date; startValue: number; targetTotal: number; targetEndDate: Date };
    const goalPeriods: GoalPeriod[] = [];

    if (sortedSnaps.length > 0) {
      let currentTarget = sortedSnaps[0].targetTotal;
      let currentEnd = sortedSnaps[0].targetEndDate;
      let periodStart = startOfDay(parseISO(sortedSnaps[0].date));
      let periodStartValue = sortedSnaps[0].totalWritten;

      for (let i = 1; i < sortedSnaps.length; i++) {
        const snap = sortedSnaps[i];
        if (snap.targetTotal !== currentTarget || snap.targetEndDate !== currentEnd) {
          if (currentTarget && currentEnd) {
            goalPeriods.push({
              startDate: periodStart,
              startValue: periodStartValue,
              targetTotal: currentTarget,
              targetEndDate: startOfDay(parseISO(currentEnd)),
            });
          }
          currentTarget = snap.targetTotal;
          currentEnd = snap.targetEndDate;
          periodStart = startOfDay(parseISO(snap.date));
          periodStartValue = snap.totalWritten;
        }
      }
      if (currentTarget && currentEnd) {
        goalPeriods.push({
          startDate: periodStart,
          startValue: periodStartValue,
          targetTotal: currentTarget,
          targetEndDate: startOfDay(parseISO(currentEnd)),
        });
      }
    }

    if (goalPeriods.length === 0) {
      const initialValue = realPoints.length > 0 ? realPoints[0].value : 0;
      goalPeriods.push({
        startDate: realPoints.length > 0 ? realPoints[0].date : chartStart,
        startValue: initialValue,
        targetTotal,
        targetEndDate: endDate,
      });
    }

    const idealSegments: { date: Date; value: number }[][] = goalPeriods.map((period, i) => {
      const segEnd = i < goalPeriods.length - 1
        ? goalPeriods[i + 1].startDate
        : period.targetEndDate;
      const totalDuration = differenceInDays(period.targetEndDate, period.startDate);
      const segDuration = differenceInDays(segEnd, period.startDate);
      const endValue = totalDuration > 0
        ? period.startValue + (period.targetTotal - period.startValue) * (segDuration / totalDuration)
        : period.targetTotal;
      return [
        { date: period.startDate, value: period.startValue },
        { date: segEnd, value: endValue },
      ];
    });

    const excludedRanges: { start: Date; end: Date }[] = [];
    for (const period of goals.excludedPeriods) {
      const pStart = startOfDay(parseISO(period.startDate));
      const pEnd = startOfDay(parseISO(period.endDate));
      if (pEnd >= chartStart && pStart <= chartEnd) {
        excludedRanges.push({
          start: pStart < chartStart ? chartStart : pStart,
          end: pEnd > chartEnd ? chartEnd : pEnd,
        });
      }
    }

    return { allDays, realPoints, projectedPoints, idealSegments, excludedRanges, targetTotal, chartStart, chartEnd, today };
  }, [dailySnapshots, goals, scenes, countUnit]);

  if (!chartData) return null;

  const { realPoints, projectedPoints, idealSegments, excludedRanges, targetTotal, chartStart, chartEnd, today } = chartData;

  const W = 700;
  const H = 280;
  const PAD = { top: 20, right: 20, bottom: 40, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const totalDays = Math.max(1, differenceInDays(chartEnd, chartStart));
  const maxY = Math.max(targetTotal, ...realPoints.map((p) => p.value), ...projectedPoints.map((p) => p.value)) * 1.05;

  const toX = (date: Date) => PAD.left + (differenceInDays(date, chartStart) / totalDays) * plotW;
  const toY = (value: number) => PAD.top + plotH - (value / maxY) * plotH;

  const pointsToPath = (pts: { date: Date; value: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.date).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');

  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((maxY / yTickCount) * i));

  const xTickInterval = Math.max(1, Math.ceil(totalDays / 8));
  const xTicks: Date[] = [];
  for (let i = 0; i <= totalDays; i += xTickInterval) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    xTicks.push(d);
  }

  const unitLbl = countUnit === 'characters' ? 'signes' : 'mots';

  const fmtY = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    return v.toString();
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 400 }}>
        {excludedRanges.map((r, i) => (
          <rect
            key={i}
            x={toX(r.start)}
            y={PAD.top}
            width={Math.max(3, toX(r.end) - toX(r.start) + plotW / totalDays)}
            height={plotH}
            fill="#e5e7eb"
            opacity={0.4}
          />
        ))}

        {yTicks.map((v) => (
          <line key={v} x1={PAD.left} x2={W - PAD.right} y1={toY(v)} y2={toY(v)} stroke="#e8ddd0" strokeWidth={0.5} />
        ))}

        <line x1={toX(today)} x2={toX(today)} y1={PAD.top} y2={PAD.top + plotH} stroke="#8b2252" strokeWidth={1} strokeDasharray="4,4" opacity={0.4} />

        <line x1={PAD.left} x2={W - PAD.right} y1={toY(targetTotal)} y2={toY(targetTotal)} stroke="#d4a853" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.6} />
        <text x={W - PAD.right + 2} y={toY(targetTotal) + 4} fontSize={9} fill="#d4a853" textAnchor="start">objectif</text>

        {idealSegments.map((seg, i) => (
          <path
            key={`ideal-${i}`}
            d={pointsToPath(seg)}
            fill="none"
            stroke="#c4b5a0"
            strokeWidth={1}
            strokeDasharray="6,4"
            opacity={0.5}
          />
        ))}

        {projectedPoints.length >= 2 && (
          <path
            d={pointsToPath(projectedPoints)}
            fill="none"
            stroke="#d4a853"
            strokeWidth={2}
            strokeDasharray="6,4"
          />
        )}

        {realPoints.length >= 2 && (
          <path
            d={pointsToPath(realPoints)}
            fill="none"
            stroke="#8b2252"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {realPoints.filter((_, i) => {
          if (realPoints.length <= 15) return true;
          const interval = Math.ceil(realPoints.length / 15);
          return i % interval === 0 || i === realPoints.length - 1;
        }).map((p, i) => (
          <circle key={i} cx={toX(p.date)} cy={toY(p.value)} r={3} fill="#8b2252" />
        ))}

        {realPoints.length > 0 && (
          <circle
            cx={toX(realPoints[realPoints.length - 1].date)}
            cy={toY(realPoints[realPoints.length - 1].value)}
            r={5}
            fill="#8b2252"
            stroke="white"
            strokeWidth={2}
          />
        )}

        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke="#c4b5a0" strokeWidth={1} />
        {yTicks.map((v) => (
          <text key={v} x={PAD.left - 8} y={toY(v) + 4} fontSize={10} fill="#8c7b6b" textAnchor="end">
            {fmtY(v)}
          </text>
        ))}

        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="#c4b5a0" strokeWidth={1} />
        {xTicks.map((d, i) => (
          <text key={i} x={toX(d)} y={PAD.top + plotH + 16} fontSize={10} fill="#8c7b6b" textAnchor="middle">
            {format(d, 'dd/MM', { locale: fr })}
          </text>
        ))}

        <text x={12} y={PAD.top + plotH / 2} fontSize={10} fill="#8c7b6b" textAnchor="middle" transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}>
          {unitLbl}
        </text>
      </svg>

      <div className="flex items-center gap-4 mt-3 text-xs text-ink-300 justify-center flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 bg-bordeaux-500 rounded inline-block" /> Réel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 bg-gold-400 rounded inline-block" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #d4a853 0 4px, transparent 4px 8px)' }} /> Estimation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 rounded inline-block" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #c4b5a0 0 4px, transparent 4px 8px)' }} /> Rythme idéal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-gray-200/60 rounded-sm inline-block" /> Jours exclus
        </span>
      </div>
    </div>
  );
}

// ─── Excluded Period Form (modal) ───

// ─── Excluded Periods Card (condensed) ───

function ExcludedPeriodsCard({
  goals,
  addExcludedPeriod,
  deleteExcludedPeriod,
  todayExcluded,
}: {
  goals: ProjectGoals;
  addExcludedPeriod: (data: { label: string; startDate: string; endDate: string }) => void;
  deleteExcludedPeriod: (id: string) => void;
  todayExcluded: boolean;
}) {
  const [showModal, setShowModal] = useState(false);

  const today = startOfDay(new Date());

  // Next upcoming excluded period
  const nextExcluded = useMemo(() => {
    const future = goals.excludedPeriods
      .map((ep) => ({ ...ep, start: parseISO(ep.startDate), end: parseISO(ep.endDate) }))
      .filter((ep) => isAfter(ep.end, today) || isSameDay(ep.end, today))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // If today is excluded, find the current period
    if (todayExcluded) {
      const current = future.find((ep) =>
        (isBefore(ep.start, today) || isSameDay(ep.start, today)) &&
        (isAfter(ep.end, today) || isSameDay(ep.end, today))
      );
      if (current) return { type: 'current' as const, period: current };
    }

    // Otherwise find next future period
    const next = future.find((ep) => isAfter(ep.start, today));
    if (next) return { type: 'upcoming' as const, period: next };

    return null;
  }, [goals.excludedPeriods, todayExcluded]);

  return (
    <>
      <div className="card-fantasy p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              todayExcluded ? 'bg-amber-100 text-amber-600' : 'bg-parchment-200 text-ink-300'
            )}>
              <Palmtree className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold text-ink-500">Périodes exclues</h3>
              <p className="text-xs text-ink-300 mt-0.5">
                {goals.excludedPeriods.length === 0
                  ? 'Aucune période exclue'
                  : `${goals.excludedPeriods.length} période${goals.excludedPeriods.length > 1 ? 's' : ''} configurée${goals.excludedPeriods.length > 1 ? 's' : ''}`
                }
              </p>
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

        {/* Status info */}
        <div className="mt-3 pt-3 border-t border-parchment-200 space-y-1.5">
          {todayExcluded ? (
            <div className="flex items-center gap-2 text-sm">
              <Coffee className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-amber-700 font-medium">Jour de repos aujourd'hui</span>
              {nextExcluded?.type === 'current' && (
                <span className="text-xs text-ink-200 ml-auto">
                  jusqu'au {format(parseISO(nextExcluded.period.endDate), 'dd MMM', { locale: fr })}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Pen className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-ink-400">Jour de travail aujourd'hui</span>
            </div>
          )}
          {nextExcluded?.type === 'upcoming' && (
            <p className="text-xs text-ink-200">
              Prochaine pause : <span className="font-medium text-ink-300">{nextExcluded.period.label}</span>
              {' '}le {format(parseISO(nextExcluded.period.startDate), 'dd MMM', { locale: fr })}
              {' '}({differenceInDays(parseISO(nextExcluded.period.startDate), today)} j.)
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <ExcludedPeriodsModal
          excludedPeriods={goals.excludedPeriods}
          objectiveType={goals.objectiveType}
          addExcludedPeriod={addExcludedPeriod}
          deleteExcludedPeriod={deleteExcludedPeriod}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Excluded Periods Modal ───

function ExcludedPeriodsModal({
  excludedPeriods,
  objectiveType,
  addExcludedPeriod,
  deleteExcludedPeriod,
  onClose,
}: {
  excludedPeriods: ExcludedPeriod[];
  objectiveType?: ObjectiveType;
  addExcludedPeriod: (data: { label: string; startDate: string; endDate: string }) => void;
  deleteExcludedPeriod: (id: string) => void;
  onClose: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !startDate || !endDate) return;
    addExcludedPeriod({ label, startDate, endDate });
    setLabel('');
    setStartDate('');
    setEndDate('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-500">Périodes exclues</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-ink-300 mb-4">
          Vacances, pauses, etc. Ces jours ne compteront pas dans le calcul de votre objectif
          {objectiveType === 'time' ? ' (objectif du jour/semaine à 0)' : ' journalier'}.
        </p>

        {/* Period list */}
        {excludedPeriods.length === 0 ? (
          <p className="text-sm text-ink-200 italic mb-4">Aucune période exclue.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {excludedPeriods.map((ep) => {
              const days = differenceInDays(parseISO(ep.endDate), parseISO(ep.startDate)) + 1;
              return (
                <div key={ep.id} className="flex items-center justify-between bg-parchment-100 rounded-lg p-3">
                  <div>
                    <span className="font-medium text-sm text-ink-500">{ep.label}</span>
                    <span className="text-xs text-ink-200 ml-2">
                      {format(parseISO(ep.startDate), 'dd MMM', { locale: fr })} – {format(parseISO(ep.endDate), 'dd MMM yyyy', { locale: fr })}
                      {' '}({days} j.)
                    </span>
                  </div>
                  <button onClick={() => deleteExcludedPeriod(ep.id)} className="btn-ghost p-1 text-red-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add form */}
        {showAddForm ? (
          <form onSubmit={handleSubmit} className="border border-parchment-200 rounded-lg p-4 space-y-3">
            <div>
              <label className="label-field">Libellé</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="input-field" placeholder="Vacances d'été" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Début</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="label-field">Fin</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" required />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary text-sm">Annuler</button>
              <button type="submit" className="btn-primary text-sm">Ajouter</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-ghost text-sm flex items-center gap-1.5 text-bordeaux-500"
          >
            <Plus className="w-4 h-4" /> Ajouter une période
          </button>
        )}

        <div className="flex justify-end mt-5 pt-4 border-t border-parchment-200">
          <button onClick={onClose} className="btn-primary">Fermer</button>
        </div>
      </div>
    </div>
  );
}
