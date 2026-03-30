import { useState, useMemo } from 'react';
import { Target, Plus, Trash2, Calendar, TrendingUp, CheckCircle, Clock, X } from 'lucide-react';
import { format, parseISO, differenceInDays, eachDayOfInterval, startOfDay, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBookStore } from '@/store/useBookStore';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  getSceneProgress, getOverallProgress, getIncompleteScenesCount,
  getCompletedScenesCount, getWorkingDaysRemaining, getScenesPerDay,
  getDaysUntilDeadline, countExcludedDays, getTodayProgress
} from '@/lib/calculations';
import { cn, countUnitLabel } from '@/lib/utils';

export function ProgressPage() {
  const scenes = useBookStore((s) => s.scenes);
  const goals = useBookStore((s) => s.goals);
  const chapters = useBookStore((s) => s.chapters);
  const writingSessions = useBookStore((s) => s.writingSessions);
  const updateGoals = useBookStore((s) => s.updateGoals);
  const updateScene = useBookStore((s) => s.updateScene);
  const writingMode = useBookStore((s) => s.writingMode);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const bookId = useBookStore((s) => s.id);
  const addExcludedPeriod = useBookStore((s) => s.addExcludedPeriod);
  const deleteExcludedPeriod = useBookStore((s) => s.deleteExcludedPeriod);

  const [showExcludeForm, setShowExcludeForm] = useState(false);

  const overallProgress = getOverallProgress(scenes);
  const completedScenes = getCompletedScenesCount(scenes);
  const incompleteScenes = getIncompleteScenesCount(scenes);
  const workingDays = getWorkingDaysRemaining(goals);
  const scenesPerDay = getScenesPerDay(scenes, goals);
  const daysUntilDeadline = getDaysUntilDeadline(goals);
  const totalWords = scenes.reduce((sum, s) => sum + s.currentWordCount, 0);

  // Daily progress tracking
  const dailyGoal = goals.dailyGoal ?? 0;
  const { todayCount } = getTodayProgress(bookId, totalWords);
  const dailyGoalReached = dailyGoal > 0 && todayCount >= dailyGoal;

  return (
    <div className="page-container">
      <h2 className="section-title mb-6">Objectif & Avancement</h2>

      {scenes.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Pas de scenes"
          description="Creez des chapitres et des scenes dans l'onglet Chapitres pour commencer a suivre votre avancement."
        />
      ) : (
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="card-fantasy p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-ink-500">Progression globale</h3>
              <span className="text-2xl font-display font-bold text-bordeaux-500">
                {Math.round(overallProgress * 100)}%
              </span>
            </div>
            <div className="h-4 bg-parchment-200 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-bordeaux-500 to-gold-400 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <StatCard icon={CheckCircle} label="Scenes terminees" value={`${completedScenes}/${scenes.length}`} />
              <StatCard icon={TrendingUp} label={`${countUnit === 'characters' ? 'Signes' : 'Mots'} ecrits`} value={totalWords.toLocaleString()} />
              <StatCard icon={Clock} label="Jours de travail restants" value={workingDays.toString()} />
              <StatCard icon={Calendar} label="Scenes/jour necessaires" value={scenesPerDay.toFixed(1)} />
            </div>
          </div>

          {/* Daily Progress */}
          <div className={cn(
            'card-fantasy p-6 border-2',
            dailyGoalReached ? 'border-green-300 bg-green-50/30' : dailyGoal > 0 ? 'border-parchment-200' : 'border-parchment-200'
          )}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-semibold text-ink-500">Aujourd'hui</h3>
              {dailyGoalReached && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <CheckCircle className="w-5 h-5" /> Objectif atteint !
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-3xl font-display font-bold text-ink-500">
                  {todayCount.toLocaleString('fr-FR')}
                  <span className="text-sm font-normal text-ink-300 ml-2">
                    {countUnit === 'characters' ? 'signes' : 'mots'} aujourd'hui
                  </span>
                </p>
                {dailyGoal > 0 && (
                  <div className="mt-2">
                    <div className="h-2.5 bg-parchment-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          dailyGoalReached ? 'bg-green-500' : 'bg-bordeaux-400'
                        )}
                        style={{ width: `${Math.min(100, (todayCount / dailyGoal) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-ink-200 mt-1">
                      {todayCount.toLocaleString('fr-FR')} / {dailyGoal.toLocaleString('fr-FR')} {countUnit === 'characters' ? 'signes' : 'mots'}
                      {' '}({Math.round((todayCount / dailyGoal) * 100)}%)
                    </p>
                  </div>
                )}
                {!dailyGoal && (
                  <p className="text-xs text-ink-200 mt-1">
                    Définissez un objectif journalier dans les paramètres ci-dessous.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Goals Settings */}
          <div className="card-fantasy p-6">
            <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">Parametres</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-field">Date de debut</label>
                <input
                  type="date"
                  value={goals.startDate ?? ''}
                  onChange={(e) => updateGoals({ startDate: e.target.value || undefined })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Date de fin cible</label>
                <input
                  type="date"
                  value={goals.targetEndDate ?? ''}
                  onChange={(e) => updateGoals({ targetEndDate: e.target.value || undefined })}
                  className="input-field"
                />
                {daysUntilDeadline > 0 && (
                  <p className="text-xs text-ink-200 mt-1">Dans {daysUntilDeadline} jours</p>
                )}
                {daysUntilDeadline < 0 && (
                  <p className="text-xs text-red-500 mt-1">Depassee de {Math.abs(daysUntilDeadline)} jours</p>
                )}
              </div>
              <div>
                <label className="label-field">{countUnit === 'characters' ? 'Signes par scène (par défaut)' : 'Mots par scene (par defaut)'}</label>
                <input
                  type="number"
                  value={goals.defaultWordsPerScene}
                  onChange={(e) => updateGoals({ defaultWordsPerScene: Number(e.target.value) })}
                  className="input-field"
                  min={100}
                />
              </div>
              <div>
                <label className="label-field">Objectif journalier ({countUnit === 'characters' ? 'signes' : 'mots'})</label>
                <input
                  type="number"
                  value={goals.dailyGoal ?? ''}
                  onChange={(e) => updateGoals({ dailyGoal: e.target.value ? Number(e.target.value) : undefined })}
                  className="input-field"
                  min={0}
                  placeholder={countUnit === 'characters' ? 'ex: 3000' : 'ex: 500'}
                />
                <p className="text-xs text-ink-200 mt-1">
                  Laissez vide pour desactiver le suivi journalier
                </p>
              </div>
            </div>
          </div>

          {/* Excluded Periods */}
          <div className="card-fantasy p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-ink-500">Periodes exclues</h3>
              <button onClick={() => setShowExcludeForm(true)} className="btn-ghost text-sm flex items-center gap-1">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>
            {goals.excludedPeriods.length === 0 ? (
              <p className="text-sm text-ink-200 italic">Aucune periode exclue (vacances, etc.)</p>
            ) : (
              <div className="space-y-2">
                {goals.excludedPeriods.map((ep) => {
                  const days = differenceInDays(parseISO(ep.endDate), parseISO(ep.startDate)) + 1;
                  return (
                    <div key={ep.id} className="flex items-center justify-between bg-parchment-100 rounded-lg p-3">
                      <div>
                        <span className="font-medium text-sm text-ink-500">{ep.label}</span>
                        <span className="text-xs text-ink-200 ml-2">
                          {format(parseISO(ep.startDate), 'dd MMM', { locale: fr })} - {format(parseISO(ep.endDate), 'dd MMM yyyy', { locale: fr })}
                          {' '}({days} jours)
                        </span>
                      </div>
                      <button onClick={() => deleteExcludedPeriod(ep.id)} className="btn-ghost p-1 text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scene Progress */}
          <div className="card-fantasy p-6">
            <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">Avancement par scene</h3>
            <div className="space-y-2">
              {chapters.sort((a, b) => a.number - b.number).map((chapter) => {
                const chapterScenes = chapter.sceneIds
                  .map((sid) => scenes.find((s) => s.id === sid))
                  .filter(Boolean) as typeof scenes;

                if (chapterScenes.length === 0) return null;

                return (
                  <div key={chapter.id}>
                    <div className="flex items-center gap-2 mb-2 mt-4">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chapter.color }} />
                      <h4 className="text-sm font-medium text-ink-400">
                        Chapitre {chapter.number}{chapter.title ? ` — ${chapter.title}` : ''}
                      </h4>
                    </div>
                    {chapterScenes.map((scene, sceneIdx) => {
                      const progress = getSceneProgress(scene);
                      const sceneLabel = scene.title || `Scène ${sceneIdx + 1}`;
                      return (
                        <div key={scene.id} className="flex items-center gap-3 py-1.5">
                          <span className="text-sm text-ink-400 w-40 truncate">{sceneLabel}</span>
                          <div className="flex-1 h-2 bg-parchment-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                progress >= 1 ? 'bg-green-500' : progress > 0.5 ? 'bg-gold-400' : 'bg-bordeaux-400'
                              )}
                              style={{ width: `${progress * 100}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-2 w-32">
                            {writingMode === 'write' ? (
                              <span className="text-xs text-ink-400 w-20 text-center">{scene.currentWordCount}</span>
                            ) : (
                              <input
                                type="number"
                                value={scene.currentWordCount}
                                onChange={(e) => updateScene(scene.id, { currentWordCount: Number(e.target.value) })}
                                className="input-field text-xs py-1 px-2 w-20 text-center"
                                min={0}
                              />
                            )}
                            <span className="text-xs text-ink-200">/ {scene.targetWordCount} {countUnitLabel(countUnit)}</span>
                          </div>
                          {progress >= 1 && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Writing Calendar (simple) */}
          <div className="card-fantasy p-6">
            <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">Calendrier d'ecriture</h3>
            <WritingCalendar />
          </div>

        </div>
      )}

      {showExcludeForm && (
        <ExcludedPeriodForm onClose={() => setShowExcludeForm(false)} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="text-center">
      <Icon className="w-5 h-5 text-gold-500 mx-auto mb-1" />
      <div className="text-lg font-bold text-ink-500">{value}</div>
      <div className="text-xs text-ink-200">{label}</div>
    </div>
  );
}

function ExcludedPeriodForm({ onClose }: { onClose: () => void }) {
  const addExcludedPeriod = useBookStore((s) => s.addExcludedPeriod);
  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !startDate || !endDate) return;
    addExcludedPeriod({ label, startDate, endDate });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-500">Periode exclue</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Libelle</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="input-field" placeholder="Vacances d'ete" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Debut</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="label-field">Fin</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" required />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">Ajouter</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WritingCalendar() {
  const writingSessions = useBookStore((s) => s.writingSessions);
  const goals = useBookStore((s) => s.goals);

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 34);

  const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

  const sessionsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const session of writingSessions) {
      const day = session.date.split('T')[0];
      map[day] = (map[day] ?? 0) + session.wordsWritten;
    }
    return map;
  }, [writingSessions]);

  const maxWords = Math.max(...Object.values(sessionsByDay), 1);

  return (
    <div className="flex flex-wrap gap-1">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const words = sessionsByDay[key] ?? 0;
        const intensity = words / maxWords;
        const isExcluded = goals.excludedPeriods.some((ep) => {
          try {
            return isWithinInterval(startOfDay(day), {
              start: startOfDay(parseISO(ep.startDate)),
              end: startOfDay(parseISO(ep.endDate)),
            });
          } catch { return false; }
        });

        return (
          <div
            key={key}
            className="w-5 h-5 rounded-sm"
            title={`${format(day, 'dd/MM/yyyy')}: ${words} mots`}
            style={{
              backgroundColor: isExcluded
                ? '#e5e7eb'
                : words > 0
                  ? `rgba(139, 34, 82, ${0.2 + intensity * 0.8})`
                  : '#f5ede1',
            }}
          />
        );
      })}
    </div>
  );
}
