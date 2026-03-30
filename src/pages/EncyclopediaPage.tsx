import { useNavigate } from 'react-router-dom';
import { Users, MapPin, Map, Globe, BookOpen, Target, Eye, Clock, Lightbulb, LayoutDashboard, Feather, Film, PenLine } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useReviewStore } from '@/store/useReviewStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useEffect, useMemo } from 'react';
import { getTodayProgress } from '@/lib/calculations';
import { countUnitLabel } from '@/lib/utils';

export function EncyclopediaPage() {
  const navigate = useNavigate();
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const genre = useBookStore((s) => s.genre);
  const synopsis = useBookStore((s) => s.synopsis);
  const characters = useBookStore((s) => s.characters);
  const places = useBookStore((s) => s.places);
  const maps = useBookStore((s) => s.maps ?? []);
  const worldNotes = useBookStore((s) => s.worldNotes);
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const goals = useBookStore((s) => s.goals);
  const noteIdeas = useBookStore((s) => s.noteIdeas ?? []);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const bookId = useBookStore((s) => s.id);

  const user = useAuthStore((s) => s.user);
  const reviewSessions = useReviewStore((s) => s.sessions);
  const loadReviewSessions = useReviewStore((s) => s.loadSessions);

  useEffect(() => {
    if (user) loadReviewSessions();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Word/character count
  const totalCount = useMemo(
    () => scenes.reduce((sum, s) => sum + (s.currentWordCount ?? 0), 0),
    [scenes]
  );

  // Today's progress
  const todayProgress = useMemo(
    () => bookId ? getTodayProgress(bookId, totalCount) : { todayCount: 0, startOfDayTotal: 0 },
    [bookId, totalCount]
  );

  // Scene statuses
  const scenesByStatus = useMemo(() => {
    const map = { outline: 0, draft: 0, revision: 0, complete: 0 };
    for (const s of scenes) map[s.status] = (map[s.status] || 0) + 1;
    return map;
  }, [scenes]);

  // Reviews for this book
  const activeReviews = useMemo(
    () => reviewSessions.filter((s) => s.bookId === bookId && s.status !== 'closed'),
    [reviewSessions, bookId]
  );
  const pendingComments = useMemo(
    () => activeReviews.reduce((sum, s) => sum + (s.pendingCommentsCount ?? 0), 0),
    [activeReviews]
  );

  const unit = countUnitLabel(countUnit);
  const dailyGoal = goals.dailyGoal ?? 0;
  const dailyPct = dailyGoal > 0 ? Math.min(100, Math.round((todayProgress.todayCount / dailyGoal) * 100)) : 0;

  const encyclopediaCards = [
    { label: 'Personnages', count: characters.length, icon: Users, color: 'bg-bordeaux-100 text-bordeaux-500', to: '/characters' },
    { label: 'Lieux', count: places.length, icon: MapPin, color: 'bg-gold-100 text-gold-600', to: '/places' },
    { label: 'Cartes', count: maps.length, icon: Map, color: 'bg-blue-100 text-blue-500', to: '/maps' },
    { label: 'Univers', count: worldNotes.length, icon: Globe, color: 'bg-green-100 text-green-600', to: '/world' },
  ];

  return (
    <div className="page-container max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="section-title flex items-center gap-3">
          <LayoutDashboard className="w-7 h-7 text-bordeaux-400" />
          Vue d'ensemble
        </h2>
        <div className="mt-2">
          <p className="text-lg font-display font-bold text-ink-500">
            {title || 'Sans titre'}
          </p>
          <div className="flex items-center gap-3 text-sm text-ink-300 mt-0.5">
            {author && <span>{author}</span>}
            {genre && <><span className="text-ink-200">·</span><span>{genre}</span></>}
          </div>
        </div>
        {synopsis && (
          <p className="text-sm text-ink-300 mt-2 italic max-w-2xl">{synopsis}</p>
        )}
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="card-fantasy p-4 text-center">
          <p className="text-2xl font-display font-bold text-bordeaux-500">{chapters.length}</p>
          <p className="text-xs text-ink-300 mt-1">Chapitre{chapters.length > 1 ? 's' : ''}</p>
        </div>
        <div className="card-fantasy p-4 text-center">
          <p className="text-2xl font-display font-bold text-bordeaux-500">{scenes.length}</p>
          <p className="text-xs text-ink-300 mt-1">Scène{scenes.length > 1 ? 's' : ''}</p>
        </div>
        <div className="card-fantasy p-4 text-center">
          <p className="text-2xl font-display font-bold text-bordeaux-500">{totalCount.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-ink-300 mt-1">{unit}</p>
        </div>
        <div className="card-fantasy p-4 text-center">
          <p className="text-2xl font-display font-bold text-bordeaux-500">
            {characters.length + places.length + maps.length + worldNotes.length}
          </p>
          <p className="text-xs text-ink-300 mt-1">Fiches encyclopédie</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily goal */}
        <button onClick={() => navigate('/progress')} className="card-fantasy p-5 text-left hover:shadow-lg hover:border-bordeaux-300 transition-all duration-200 group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-bordeaux-100 flex items-center justify-center text-bordeaux-500 group-hover:scale-105 transition-transform">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-ink-500">Objectif du jour</h3>
              <p className="text-xs text-ink-300">
                {dailyGoal > 0
                  ? `${todayProgress.todayCount.toLocaleString('fr-FR')} / ${dailyGoal.toLocaleString('fr-FR')} ${unit}`
                  : 'Non défini'}
              </p>
            </div>
          </div>
          {dailyGoal > 0 && (
            <div className="w-full bg-parchment-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-bordeaux-400"
                style={{ width: `${dailyPct}%` }}
              />
            </div>
          )}
          {dailyGoal > 0 && (
            <p className="text-xs text-ink-200 mt-1.5 text-right">{dailyPct}%</p>
          )}
        </button>

        {/* Manuscript status */}
        <button onClick={() => navigate('/chapters')} className="card-fantasy p-5 text-left hover:shadow-lg hover:border-bordeaux-300 transition-all duration-200 group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gold-100 flex items-center justify-center text-gold-600 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-ink-500">Manuscrit</h3>
              <p className="text-xs text-ink-300">{scenes.length} scène{scenes.length > 1 ? 's' : ''} au total</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Plan', count: scenesByStatus.outline, color: 'bg-ink-200' },
              { label: 'Brouillon', count: scenesByStatus.draft, color: 'bg-amber-400' },
              { label: 'Révision', count: scenesByStatus.revision, color: 'bg-blue-400' },
              { label: 'Terminé', count: scenesByStatus.complete, color: 'bg-green-400' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-ink-300 flex-1">{s.label}</span>
                <span className="font-medium text-ink-400">{s.count}</span>
              </div>
            ))}
          </div>
        </button>

        {/* Reviews */}
        <button onClick={() => navigate('/reviews')} className="card-fantasy p-5 text-left hover:shadow-lg hover:border-bordeaux-300 transition-all duration-200 group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-500 group-hover:scale-105 transition-transform">
              <Eye className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-ink-500">Relectures</h3>
              <p className="text-xs text-ink-300">
                {activeReviews.length} relecture{activeReviews.length > 1 ? 's' : ''} active{activeReviews.length > 1 ? 's' : ''}
              </p>
            </div>
            {pendingComments > 0 && (
              <span className="text-[10px] font-bold bg-bordeaux-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                {pendingComments}
              </span>
            )}
          </div>
        </button>

        {/* Notes & Ideas */}
        <button onClick={() => navigate('/notes')} className="card-fantasy p-5 text-left hover:shadow-lg hover:border-bordeaux-300 transition-all duration-200 group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-500 group-hover:scale-105 transition-transform">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-ink-500">Notes & Idées</h3>
              <p className="text-xs text-ink-300">{noteIdeas.length} note{noteIdeas.length > 1 ? 's' : ''}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Encyclopedia grid */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-ink-300 uppercase tracking-wider">Encyclopédie</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {encyclopediaCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.to}
              onClick={() => navigate(card.to)}
              className="card-fantasy p-4 text-center hover:shadow-lg hover:border-bordeaux-300 transition-all duration-200 hover:-translate-y-0.5 group"
            >
              <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center ${card.color} group-hover:scale-105 transition-transform mb-2`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-xl font-display font-bold text-bordeaux-500">{card.count}</p>
              <p className="text-xs text-ink-300 mt-0.5">{card.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
