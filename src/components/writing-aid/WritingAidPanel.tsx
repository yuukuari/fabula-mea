import { useEffect, useMemo, useState } from 'react';
import { Wand2, ScanText, BookMarked, BookX, Sparkles, Search, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useWritingAidStore, normalizeWord, type WritingAidTab, type WritingAidTool } from '@/store/useWritingAidStore';
import { cn, isSpecialChapter, getChapterShortLabel, tiptapHtmlToPlainText } from '@/lib/utils';
import { fetchCnrtl } from '@/lib/cnrtl';
import { STAGE_LABELS, DIMENSION_HELP, type ReportStage } from '@/lib/writing-aid/report';
import { runReport, runRepetitions } from '@/lib/writing-aid/worker-client';
import { STYLE_FIGURES } from '@/lib/writing-aid/style-figures';
import type { AnalysisScope, RepetitionItem, WordHit } from '@/lib/writing-aid/types';

interface Props {
  /** Scène actuellement visible dans l'éditeur — utilisée comme défaut « Scène ». */
  currentSceneId: string | null;
}

export function WritingAidPanel({ currentSceneId }: Props) {
  const tab = useWritingAidStore((s) => s.tab);
  const setTab = useWritingAidStore((s) => s.setTab);
  const clearHighlight = useWritingAidStore((s) => s.clearHighlight);

  // Au démontage du panneau, on nettoie la surbrillance
  useEffect(() => () => clearHighlight(), [clearHighlight]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 border-b border-parchment-200 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="w-4 h-4 text-bordeaux-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Aide à l'écriture</h3>
        </div>
        <div className="flex gap-1">
          <TabButton active={tab === 'tools'} onClick={() => setTab('tools')}>Outils</TabButton>
          <TabButton active={tab === 'report'} onClick={() => setTab('report')}>Analyse</TabButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'tools'
          ? <ToolsTab currentSceneId={currentSceneId} />
          : <ReportTab currentSceneId={currentSceneId} />
        }
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 text-xs font-medium px-2 py-1.5 rounded-md transition-colors',
        active ? 'bg-bordeaux-500 text-white' : 'text-ink-300 hover:bg-parchment-200',
      )}
    >
      {children}
    </button>
  );
}

// ── Outils ───────────────────────────────────────────────────────

function ToolsTab({ currentSceneId }: { currentSceneId: string | null }) {
  const tool = useWritingAidStore((s) => s.tool);
  const setTool = useWritingAidStore((s) => s.setTool);

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-2 pb-2 flex flex-wrap gap-1 border-b border-parchment-200">
        <ToolPill icon={ScanText} active={tool === 'repetitions'} onClick={() => setTool('repetitions')}>Répétitions</ToolPill>
        <ToolPill icon={BookMarked} active={tool === 'synonyms'} onClick={() => setTool('synonyms')}>Synonymes</ToolPill>
        <ToolPill icon={BookX} active={tool === 'antonyms'} onClick={() => setTool('antonyms')}>Antonymes</ToolPill>
        <ToolPill icon={Sparkles} active={tool === 'figures'} onClick={() => setTool('figures')}>Figures de style</ToolPill>
      </div>
      <div className="p-3">
        {tool === 'repetitions' && <RepetitionsTool currentSceneId={currentSceneId} />}
        {tool === 'synonyms' && <ThesaurusTool kind="synonymie" />}
        {tool === 'antonyms' && <ThesaurusTool kind="antonymie" />}
        {tool === 'figures' && <FiguresTool />}
      </div>
    </div>
  );
}

function ToolPill({ icon: Icon, active, onClick, children }: { icon: typeof Wand2; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 text-[11px] px-2 py-1 rounded-full transition-colors',
        active ? 'bg-ink-400 text-white' : 'bg-parchment-200 text-ink-300 hover:bg-parchment-300',
      )}
    >
      <Icon className="w-3 h-3" />
      {children}
    </button>
  );
}

// ── Scope selector partagé ───────────────────────────────────────

function ScopeSelector({ currentSceneId }: { currentSceneId: string | null }) {
  const scope = useWritingAidStore((s) => s.scope);
  const setScope = useWritingAidStore((s) => s.setScope);
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);

  const currentScene = currentSceneId ? scenes.find((s) => s.id === currentSceneId) : null;
  const currentChapter = currentScene ? chapters.find((c) => c.id === currentScene.chapterId) : null;

  // Sémantique « Scène courante » / « Chapitre courant » : quand l'utilisateur
  // change de scène depuis la sidebar, on suit automatiquement (sinon le scope
  // pointe vers une scène/chapitre orphelin et l'analyse cible le mauvais texte).
  useEffect(() => {
    if (scope.kind === 'scene' && currentSceneId && scope.sceneId !== currentSceneId) {
      setScope({ kind: 'scene', sceneId: currentSceneId });
    } else if (scope.kind === 'chapter' && currentChapter && scope.chapterId !== currentChapter.id) {
      setScope({ kind: 'chapter', chapterId: currentChapter.id });
    }
  }, [currentSceneId, currentChapter, scope, setScope]);

  return (
    <div className="flex gap-1 mb-3">
      <ScopeBtn
        active={scope.kind === 'scene'}
        disabled={!currentSceneId}
        onClick={() => currentSceneId && setScope({ kind: 'scene', sceneId: currentSceneId })}
      >Scène</ScopeBtn>
      <ScopeBtn
        active={scope.kind === 'chapter'}
        disabled={!currentChapter}
        onClick={() => currentChapter && setScope({ kind: 'chapter', chapterId: currentChapter.id })}
      >Chapitre</ScopeBtn>
      <ScopeBtn active={scope.kind === 'book'} onClick={() => setScope({ kind: 'book' })}>Livre</ScopeBtn>
    </div>
  );
}

function ScopeBtn({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 text-[11px] px-2 py-1 rounded-md transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        active ? 'bg-bordeaux-100 text-bordeaux-600 ring-1 ring-bordeaux-300' : 'bg-parchment-100 text-ink-300 hover:bg-parchment-200',
      )}
    >
      {children}
    </button>
  );
}

// ── Répétitions ──────────────────────────────────────────────────

function RepetitionsTool({ currentSceneId }: { currentSceneId: string | null }) {
  const scope = useWritingAidStore((s) => s.scope);
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [items, setItems] = useState<RepetitionItem[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setProgress(0);
    try {
      const result = await runRepetitions(scope, scenes, chapters, (_stage, ratio) => {
        setProgress(ratio);
      });
      setItems(result.items);
    } finally {
      setRunning(false);
      setProgress(1);
    }
  };

  // Reset quand le scope change
  useEffect(() => { setItems(null); setExpanded(null); }, [scope]);

  return (
    <div>
      <ScopeSelector currentSceneId={currentSceneId} />
      <button
        onClick={run}
        disabled={running}
        className="w-full text-xs font-medium bg-bordeaux-500 hover:bg-bordeaux-600 disabled:opacity-50 text-white py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5"
      >
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
        {running ? 'Analyse en cours…' : 'Détecter les répétitions'}
      </button>

      {running && <ProgressBar ratio={progress} label="Lecture du manuscrit…" />}

      {items && items.length === 0 && (
        <p className="text-xs text-ink-200 italic text-center mt-4">Aucune répétition notable.</p>
      )}

      {items && items.length > 0 && (
        <ul className="mt-3 space-y-1">
          {items.map((it) => (
            <HitItem
              key={it.word}
              label={it.word}
              count={it.count}
              concentration={it.maxWindowCount}
              windowSize={it.windowSize}
              hits={it.hits}
              selected={expanded === it.word}
              onToggle={() => setExpanded(expanded === it.word ? null : it.word)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Barre de progression de l'analyse ────────────────────────────

function ProgressBar({ ratio, label }: { ratio: number; label: string }) {
  const pct = Math.max(2, Math.round(ratio * 100));
  return (
    <div className="mt-3 space-y-1">
      <div className="h-1.5 w-full bg-parchment-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-bordeaux-400 to-bordeaux-600 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-ink-300 text-center italic flex items-center justify-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin text-bordeaux-400" />
        {label}
      </p>
    </div>
  );
}

// ── Item de liste avec navigation hit-par-hit + surbrillance ─────

function HitItem({ label, count, concentration, windowSize, hits, selected, onToggle, italicLabel }: {
  label: string;
  count: number;
  /** Si fourni, indique la concentration locale max (ex. 4 occurrences dans une même fenêtre). */
  concentration?: number;
  /** Taille de la fenêtre utilisée pour la concentration, pour le tooltip. */
  windowSize?: number;
  hits: WordHit[];
  selected: boolean;
  onToggle: () => void;
  italicLabel?: boolean;
}) {
  const showConcentration = concentration !== undefined && concentration > 1 && concentration < count;
  return (
    <li className={cn('rounded border', selected ? 'border-bordeaux-300' : 'border-parchment-200')}>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between px-2 py-1.5 transition-colors',
          selected ? 'bg-bordeaux-50' : 'hover:bg-parchment-100',
        )}
      >
        <span className={cn('text-xs font-medium truncate', italicLabel && 'italic', selected ? 'text-bordeaux-600' : 'text-ink-400')}>
          {label}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {showConcentration && (
            <span
              className="text-[10px] tabular-nums text-ink-300"
              title={`${concentration} occurrences dans une même fenêtre de ${windowSize} mots`}
            >
              {concentration}/{windowSize}
            </span>
          )}
          <span className="text-[10px] tabular-nums text-bordeaux-500 font-semibold">×{count}</span>
          <ChevronRight className={cn('w-3 h-3 text-ink-200 transition-transform', selected && 'rotate-90')} />
        </span>
      </button>
      {selected && <HitNavigator hits={hits} />}
    </li>
  );
}

function HitNavigator({ hits }: { hits: WordHit[] }) {
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const setHighlight = useWritingAidStore((s) => s.setHighlight);
  const setFocusedHit = useWritingAidStore((s) => s.setFocusedHit);
  const [idx, setIdx] = useState(0);

  // Variantes normalisées du mot/lemme à chercher (cf. extension TipTap)
  const variants = useMemo(
    () => new Set(hits.map((h) => normalizeWord(h.word))),
    [hits],
  );
  const sceneIds = useMemo(
    () => Array.from(new Set(hits.map((h) => h.sceneId))),
    [hits],
  );
  const words = useMemo(
    () => Array.from(new Set(hits.map((h) => h.word.toLowerCase()))),
    [hits],
  );

  // Recompute en direct les occurrences dans les scènes du scope.
  // S'abonne à `scenes` du store : si l'utilisateur édite une scène, la liste
  // se met à jour automatiquement (compteur baisse, navigation reste cohérente).
  const liveOccurrences = useMemo(() => {
    const result: { sceneId: string; chapterId: string; occurrenceIndex: number }[] = [];
    for (const sid of sceneIds) {
      const scene = scenes.find((s) => s.id === sid);
      if (!scene) continue;
      const text = tiptapHtmlToPlainText(scene.content ?? '');
      const re = /\p{L}+/gu;
      let m: RegExpExecArray | null;
      let occIdx = 0;
      while ((m = re.exec(text)) !== null) {
        if (variants.has(normalizeWord(m[0]))) {
          result.push({ sceneId: sid, chapterId: scene.chapterId, occurrenceIndex: occIdx });
          occIdx++;
        }
      }
    }
    return result;
  }, [scenes, sceneIds, variants]);

  // Pose la surbrillance globale, nettoie au démontage
  useEffect(() => {
    setHighlight({ words, sceneIds, nonce: Date.now() });
    setIdx(0);
    return () => {
      setHighlight(null);
      setFocusedHit(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits]);

  // Clamp implicite : si le texte a été édité et que la liste a rétréci, on
  // utilise `safeIdx` à la fois pour l'affichage et pour piloter `focusedHit`.
  // Les handlers prev/next ré-alignent ensuite naturellement via le modulo.
  const safeIdx = liveOccurrences.length > 0 ? Math.min(idx, liveOccurrences.length - 1) : 0;

  // Met à jour l'occurrence ciblée
  useEffect(() => {
    const h = liveOccurrences[safeIdx];
    if (!h) return;
    setFocusedHit({ sceneId: h.sceneId, occurrenceIndex: h.occurrenceIndex, nonce: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIdx, liveOccurrences]);

  if (liveOccurrences.length === 0) {
    return (
      <div className="px-2 py-1.5 border-t border-parchment-200 bg-parchment-50/60 text-[10px] italic text-ink-200 text-center">
        Plus d'occurrences dans le texte actuel.
      </div>
    );
  }
  const cur = liveOccurrences[safeIdx];
  const sc = scenes.find((s) => s.id === cur.sceneId);
  const ch = chapters.find((c) => c.id === cur.chapterId);
  const sceneIdxInChapter = ch ? (ch.sceneIds ?? []).indexOf(cur.sceneId) + 1 : 0;
  const chapterLabel = ch ? (isSpecialChapter(ch) ? getChapterShortLabel(ch) : `Ch. ${ch.number}`) : '';
  const sceneLabel = sc?.title || (sceneIdxInChapter > 0 ? `Scène ${sceneIdxInChapter}` : 'Scène');

  return (
    <div className="flex items-center gap-1 px-1.5 py-1 border-t border-parchment-200 bg-parchment-50/60">
      <button
        onClick={() => setIdx((i) => (i - 1 + liveOccurrences.length) % liveOccurrences.length)}
        className="p-1 rounded text-ink-300 hover:text-bordeaux-500 hover:bg-parchment-200 transition-colors"
        title="Occurrence précédente"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1 text-center text-[10px] truncate">
        <span className="text-bordeaux-500 font-semibold tabular-nums">{safeIdx + 1}</span>
        <span className="text-ink-200">/{liveOccurrences.length}</span>
        <span className="text-ink-200"> · </span>
        <span className="text-ink-400">{chapterLabel}</span>
        {chapterLabel && <span className="text-ink-200">, </span>}
        <span className="text-ink-400 truncate">{sceneLabel}</span>
      </div>
      <button
        onClick={() => setIdx((i) => (i + 1) % liveOccurrences.length)}
        className="p-1 rounded text-ink-300 hover:text-bordeaux-500 hover:bg-parchment-200 transition-colors"
        title="Occurrence suivante"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Synonymes / Antonymes ────────────────────────────────────────

function ThesaurusTool({ kind }: { kind: 'synonymie' | 'antonymie' }) {
  const [word, setWord] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [results, setResults] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset quand on bascule synonymes ↔ antonymes
  useEffect(() => { setWord(''); setSubmitted(''); setResults(null); }, [kind]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = word.trim();
    if (!w) return;
    setSubmitted(w);
    setLoading(true);
    setResults(null);
    fetchCnrtl(kind, w).then((r) => {
      setResults(r);
      setLoading(false);
    });
  };

  const label = kind === 'synonymie' ? 'Synonymes' : 'Antonymes';

  return (
    <div>
      <form onSubmit={submit} className="flex gap-1 mb-3">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Un mot…"
          className="flex-1 text-xs px-2 py-1.5 rounded-md border border-parchment-300 bg-white focus:outline-none focus:ring-1 focus:ring-bordeaux-300"
        />
        <button
          type="submit"
          disabled={loading || !word.trim()}
          className="text-xs px-2 py-1.5 rounded-md bg-bordeaux-500 hover:bg-bordeaux-600 disabled:opacity-50 text-white transition-colors flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        </button>
      </form>

      {submitted && !loading && (
        <ThesaurusList title={`${label} de « ${submitted} »`} words={results ?? []} />
      )}
      {!submitted && (
        <p className="text-[11px] text-ink-200 italic">
          {kind === 'synonymie'
            ? 'Tapez un mot pour explorer ses synonymes.'
            : 'Tapez un mot pour trouver ses antonymes.'}
        </p>
      )}
    </div>
  );
}

function ThesaurusList({ title, words }: { title: string; words: string[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-200 font-semibold mb-1.5">{title}</p>
      {words.length === 0 ? (
        <p className="text-[11px] italic text-ink-200">Aucun résultat.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {words.map((w) => (
            <a
              key={w}
              href={`https://www.cnrtl.fr/definition/${encodeURIComponent(w)}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] px-2 py-0.5 rounded-full bg-parchment-100 hover:bg-parchment-200 text-ink-400 transition-colors"
              title="Voir la définition (CNRTL)"
            >
              {w}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Figures de style ─────────────────────────────────────────────

function FiguresTool() {
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STYLE_FIGURES;
    return STYLE_FIGURES.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      f.shortDef.toLowerCase().includes(q) ||
      f.longDef.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div>
      <div className="relative mb-2">
        <Search className="w-3 h-3 text-ink-200 absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer (métaphore, anaphore…)"
          className="w-full text-xs pl-7 pr-2 py-1.5 rounded-md border border-parchment-300 bg-white focus:outline-none focus:ring-1 focus:ring-bordeaux-300"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-200 hover:text-ink-400">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {filtered.map((fig, idx) => (
          <li key={fig.name} className="rounded border border-parchment-200">
            <button
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full flex items-start justify-between gap-2 px-2 py-1.5 hover:bg-parchment-100 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-400">{fig.name}</p>
                <p className="text-[10px] text-ink-300 truncate">{fig.shortDef}</p>
              </div>
              <ChevronRight className={cn('w-3 h-3 text-ink-200 mt-1 shrink-0 transition-transform', openIdx === idx && 'rotate-90')} />
            </button>
            {openIdx === idx && (
              <div className="border-t border-parchment-200 px-2 py-2 bg-parchment-50/60 space-y-2">
                <p className="text-[11px] text-ink-400">{fig.longDef}</p>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-bordeaux-500 font-semibold mb-0.5">À quoi ça sert</p>
                  <p className="text-[11px] text-ink-400">{fig.purpose}</p>
                </div>

                {fig.useCases.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-200 font-semibold mb-0.5">Cas concrets</p>
                    <ul className="text-[11px] text-ink-300 list-disc pl-4 space-y-0.5">
                      {fig.useCases.map((u, i) => <li key={i}>{u}</li>)}
                    </ul>
                  </div>
                )}

                {fig.beforeAfter.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-200 font-semibold mb-1">Avant / Après</p>
                    <ul className="space-y-2">
                      {fig.beforeAfter.map((ba, i) => (
                        <li key={i} className="rounded border border-parchment-200 bg-white/60 p-2 space-y-1">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-ink-200 font-semibold mr-1">Sans</span>
                            <span className="text-[11px] text-ink-300 italic font-serif">{ba.before}</span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-bordeaux-500 font-semibold mr-1">Avec</span>
                            <span className="text-[11px] text-ink-500 italic font-serif font-medium">{ba.after}</span>
                          </div>
                          {ba.comment && (
                            <p className="text-[10px] text-ink-300 border-t border-parchment-200 pt-1">{ba.comment}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {fig.examples.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-200 font-semibold mb-0.5">Exemples littéraires</p>
                    <ul className="space-y-1">
                      {fig.examples.map((ex, i) => (
                        <li key={i} className="text-[11px] text-ink-300 italic font-serif border-l-2 border-parchment-300 pl-2">
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
        {filtered.length === 0 && <li className="text-xs italic text-ink-200">Aucune figure trouvée.</li>}
      </ul>
    </div>
  );
}

// ── Relecture (rapport) ──────────────────────────────────────────

function ReportTab({ currentSceneId }: { currentSceneId: string | null }) {
  const scope = useWritingAidStore((s) => s.scope);
  const setScope = useWritingAidStore((s) => s.setScope);
  const report = useWritingAidStore((s) => s.report);
  const setReport = useWritingAidStore((s) => s.setReport);
  const loading = useWritingAidStore((s) => s.reportLoading);
  const setLoading = useWritingAidStore((s) => s.setReportLoading);
  const pendingAutoRun = useWritingAidStore((s) => s.pendingAutoRun);
  const consumeAutoRun = useWritingAidStore((s) => s.consumeAutoRun);
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const [stage, setStage] = useState<ReportStage | null>(null);
  const [progress, setProgress] = useState(0);

  // Au montage : scope par défaut = scène courante si dispo et qu'aucun rapport
  useEffect(() => {
    if (!report && currentSceneId && scope.kind === 'book') {
      setScope({ kind: 'scene', sceneId: currentSceneId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const launchAnalysis = async (s: typeof scope) => {
    setLoading(true);
    setProgress(0);
    setStage('resolve');
    try {
      const r = await runReport(s, scenes, chapters, (st, ratio) => {
        if (st !== 'detect') setStage(st);
        setProgress(ratio);
      });
      setReport(r);
    } finally {
      setLoading(false);
      setStage(null);
      setProgress(1);
    }
  };

  // Auto-run depuis les icônes contextuelles
  useEffect(() => {
    if (!pendingAutoRun) return;
    void launchAnalysis(pendingAutoRun.scope);
    consumeAutoRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoRun]);

  return (
    <div className="p-3">
      <ScopeSelector currentSceneId={currentSceneId} />
      <button
        onClick={() => void launchAnalysis(scope)}
        disabled={loading}
        className="w-full text-xs font-medium bg-bordeaux-500 hover:bg-bordeaux-600 disabled:opacity-50 text-white py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
        {loading ? 'Analyse en cours…' : 'Lancer l\'analyse'}
      </button>

      {loading && <ProgressBar ratio={progress} label={stage ? STAGE_LABELS[stage] : 'Démarrage…'} />}

      {report && !loading && <ReportView report={report} />}
    </div>
  );
}

function ReportView({ report }: { report: import('@/lib/writing-aid/types').ReportResult }) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const scoreColor = (n: number) =>
    n >= 80 ? 'text-green-600' : n >= 60 ? 'text-gold-500' : 'text-bordeaux-500';

  return (
    <div className="mt-4">
      <div className="text-center bg-parchment-100 rounded-lg p-3 mb-3">
        <p className="text-[10px] uppercase tracking-wider text-ink-200 font-semibold">Score global</p>
        <p className={cn('text-3xl font-display font-bold tabular-nums', scoreColor(report.globalScore))}>
          {report.globalScore}<span className="text-sm text-ink-300">/100</span>
        </p>
        <p className="text-[10px] text-ink-300 mt-1">{report.totalWords.toLocaleString('fr-FR')} mots analysés</p>
      </div>

      <ul className="space-y-1.5">
        {report.scores.map((s) => (
          <li key={s.key}>
            <button
              onClick={() => setOpenSection(openSection === s.key ? null : s.key)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-parchment-200 hover:bg-parchment-100 transition-colors"
            >
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-ink-400">{s.label}</p>
                <p className="text-[10px] text-ink-300 leading-snug">{s.detail}</p>
              </div>
              <span className={cn('text-sm font-bold tabular-nums shrink-0', scoreColor(s.score))}>{s.score}</span>
              <ChevronRight className={cn('w-3 h-3 text-ink-200 transition-transform', openSection === s.key && 'rotate-90')} />
            </button>
            {openSection === s.key && (
              <ReportSectionDetail sectionKey={s.key} report={report} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SentenceList({ sentences }: { sentences: import('@/lib/writing-aid/types').SentenceStat[] }) {
  const setFocusedSentence = useWritingAidStore((s) => s.setFocusedSentence);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const onClick = (i: number, st: import('@/lib/writing-aid/types').SentenceStat) => {
    if (selectedIdx === i) {
      setSelectedIdx(null);
      setFocusedSentence(null);
      return;
    }
    setSelectedIdx(i);
    setFocusedSentence({ sceneId: st.sceneId, text: st.text, nonce: Date.now() });
  };

  if (sentences.length === 0) {
    return <p className="text-[11px] italic text-ink-200 px-2 py-2">Pas de phrases anormalement longues.</p>;
  }

  return (
    <ul className="border-x border-b border-parchment-200 rounded-b bg-parchment-50/60 max-h-72 overflow-y-auto">
      {sentences.map((st, i) => (
        <li key={i} className="px-2 py-1.5 text-[11px] border-t border-parchment-200 first:border-t-0">
          <button
            onClick={() => onClick(i, st)}
            className={cn(
              'w-full text-left transition-colors',
              selectedIdx === i ? 'text-bordeaux-600' : 'hover:text-bordeaux-600',
            )}
          >
            <span className="text-bordeaux-500 font-semibold tabular-nums mr-1">{st.wordCount} mots</span>
            <span className={cn('italic', selectedIdx === i ? 'text-ink-500' : 'text-ink-300')}>
              {st.text.slice(0, 100)}{st.text.length > 100 ? '…' : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function NavigableList({ items, italicLabel }: {
  items: Array<{ key: string; label: string; count: number; concentration?: number; windowSize?: number; hits: WordHit[] }>;
  italicLabel?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ul className="border-x border-b border-parchment-200 rounded-b bg-parchment-50/60 max-h-72 overflow-y-auto p-1 space-y-1">
      {items.map((it) => (
        <HitItem
          key={it.key}
          label={it.label}
          count={it.count}
          concentration={it.concentration}
          windowSize={it.windowSize}
          hits={it.hits}
          italicLabel={italicLabel}
          selected={selected === it.key}
          onToggle={() => setSelected(selected === it.key ? null : it.key)}
        />
      ))}
    </ul>
  );
}

function DimensionHelpBlock({ sectionKey }: { sectionKey: string }) {
  const help = DIMENSION_HELP[sectionKey];
  if (!help) return null;
  return (
    <div className="border-x border-parchment-200 bg-parchment-50/40 px-3 py-2 text-[11px] text-ink-300 space-y-1.5">
      <p>{help.what}</p>
      <p><span className="font-semibold text-ink-400">Seuils : </span>{help.thresholds}</p>
      <p><span className="font-semibold text-ink-400">Pour améliorer : </span>{help.howToImprove}</p>
    </div>
  );
}

function ReportSectionDetail({ sectionKey, report }: {
  sectionKey: string;
  report: import('@/lib/writing-aid/types').ReportResult;
}) {
  const help = <DimensionHelpBlock sectionKey={sectionKey} />;
  if (sectionKey === 'repetitions') {
    if (report.repetitions.length === 0) return <>{help}<p className="text-[11px] italic text-ink-200 px-2 py-2 border-x border-b border-parchment-200 rounded-b bg-parchment-50/60">Aucune répétition signalée.</p></>;
    return <>{help}<NavigableList items={report.repetitions.slice(0, 20).map((r) => ({ key: r.word, label: r.word, count: r.count, concentration: r.maxWindowCount, windowSize: r.windowSize, hits: r.hits }))} /></>;
  }
  if (sectionKey === 'adverbs') {
    if (report.adverbs.length === 0) return <>{help}<p className="text-[11px] italic text-ink-200 px-2 py-2 border-x border-b border-parchment-200 rounded-b bg-parchment-50/60">Aucun adverbe en -ment détecté.</p></>;
    return <>{help}<NavigableList items={report.adverbs.slice(0, 20).map((a) => ({ key: a.word, label: a.word, count: a.count, hits: a.hits }))} /></>;
  }
  if (sectionKey === 'dull-verbs') {
    if (report.dullVerbs.length === 0) return <>{help}<p className="text-[11px] italic text-ink-200 px-2 py-2 border-x border-b border-parchment-200 rounded-b bg-parchment-50/60">Pas d'abus de verbes ternes.</p></>;
    return <>{help}<NavigableList italicLabel items={report.dullVerbs.map((v) => ({ key: v.word, label: v.word, count: v.count, hits: v.hits }))} /></>;
  }
  if (sectionKey === 'sentences') {
    return <>{help}<SentenceList sentences={report.sentences.longest} /></>;
  }
  if (sectionKey === 'lexical') {
    return (
      <>
        {help}
        <div className="border-x border-b border-parchment-200 rounded-b bg-parchment-50/60 px-3 py-2 text-[11px] text-ink-300 space-y-1">
          <p>Mots pleins : <span className="font-semibold tabular-nums">{report.lexical.totalWords.toLocaleString('fr-FR')}</span></p>
          <p>Lemmes uniques : <span className="font-semibold tabular-nums">{report.lexical.uniqueWords.toLocaleString('fr-FR')}</span></p>
          <p>Ratio : <span className="font-semibold tabular-nums">{report.lexical.ratio.toFixed(3)}</span> <span className="text-ink-200">(idéal ≥ 0.55)</span></p>
        </div>
      </>
    );
  }
  return null;
}
