import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, User, MapPin, BookOpen, FileText, Globe, Map, Settings, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { useEditorStore } from '@/store/useEditorStore';
import { PLACE_TYPE_LABELS, WORLD_NOTE_CATEGORY_LABELS } from '@/lib/utils';

type ResultType = 'character' | 'place' | 'chapter' | 'scene' | 'worldNote' | 'map' | 'settings';

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle?: string;
  navigateTo: string;
}

const TYPE_ICONS: Record<ResultType, React.ElementType> = {
  character: User,
  place: MapPin,
  chapter: BookOpen,
  scene: FileText,
  worldNote: Globe,
  map: Map,
  settings: Settings,
};

const TYPE_LABELS: Record<ResultType, string> = {
  character: 'Personnage',
  place: 'Lieu',
  chapter: 'Chapitre',
  scene: 'Scène',
  worldNote: 'Univers',
  map: 'Carte',
  settings: 'Paramètres',
};

// Static shortcuts that always appear when matched
const STATIC_RESULTS: SearchResult[] = [
  { type: 'settings', id: 'settings', title: 'Paramètres', subtitle: 'Configuration du projet', navigateTo: '/settings' },
  { type: 'settings', id: 'export', title: 'Exporter', subtitle: 'Export JSON / EPUB / PDF', navigateTo: '/settings' },
  { type: 'settings', id: 'import', title: 'Importer', subtitle: 'Importer un JSON', navigateTo: '/settings' },
  { type: 'settings', id: 'save', title: 'Sauvegarder', subtitle: 'Sauvegarde du projet', navigateTo: '/settings' },
];

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const minimizeEditor = useEditorStore((s) => s.minimize);
  const editorIsOpen = useEditorStore((s) => s.isOpen);
  const { characters, places, worldNotes, maps: rawMaps } = useEncyclopediaStore();
  const maps = rawMaps ?? [];
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    // Characters
    for (const c of characters) {
      if (c.name.toLowerCase().includes(q) || c.surname?.toLowerCase().includes(q) || c.profession?.toLowerCase().includes(q)) {
        out.push({ type: 'character', id: c.id, title: `${c.name} ${c.surname ?? ''}`.trim(), subtitle: c.profession, navigateTo: `/characters/${c.id}` });
      }
    }

    // Places → URL param so PlacesPage opens the detail view (works even when already on /places)
    for (const p of places) {
      if (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) {
        out.push({ type: 'place', id: p.id, title: p.name, subtitle: PLACE_TYPE_LABELS[p.type] ?? p.type, navigateTo: `/places?placeId=${p.id}` });
      }
    }

    // Chapters
    for (const ch of chapters) {
      if ((ch.title ?? '').toLowerCase().includes(q) || `chapitre ${ch.number}`.includes(q)) {
        const chTitle = ch.title ? `Ch. ${ch.number} — ${ch.title}` : `Chapitre ${ch.number}`;
        out.push({ type: 'chapter', id: ch.id, title: chTitle, navigateTo: '/chapters' });
      }
    }

    // Scenes
    for (const sc of scenes) {
      const ch = chapters.find((c) => c.id === sc.chapterId);
      const scIdx = ch ? ch.sceneIds.indexOf(sc.id) : -1;
      const scLabel = sc.title || `Scène ${scIdx + 1}`;
      if (scLabel.toLowerCase().includes(q) || sc.description.toLowerCase().includes(q)) {
        out.push({ type: 'scene', id: sc.id, title: scLabel, subtitle: ch ? `Ch. ${ch.number}` : undefined, navigateTo: '/chapters' });
      }
    }

    // World notes → URL param so WorldPage opens the detail view
    for (const n of worldNotes) {
      if (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) {
        const label = WORLD_NOTE_CATEGORY_LABELS[n.category as string] ?? n.category;
        out.push({ type: 'worldNote', id: n.id, title: n.title, subtitle: label, navigateTo: `/world?noteId=${n.id}` });
      }
    }

    // Maps → URL param so MapsPage selects the map
    for (const m of maps) {
      if (m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)) {
        out.push({ type: 'map', id: m.id, title: m.name, subtitle: `${m.pins.length} marqueur${m.pins.length !== 1 ? 's' : ''}`, navigateTo: `/maps?mapId=${m.id}` });
      }
    }

    // Static shortcuts (Paramètres, Exporter, Importer, Sauvegarder)
    for (const s of STATIC_RESULTS) {
      if (s.title.toLowerCase().includes(q) || s.subtitle?.toLowerCase().includes(q)) {
        out.push(s);
      }
    }

    return out.slice(0, 15);
  }, [query, characters, places, chapters, scenes, worldNotes, maps]);

  useEffect(() => { setSelectedIndex(0); }, [results]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const handleSelect = useCallback((result: SearchResult) => {
    if (editorIsOpen) minimizeEditor();
    navigate(result.navigateTo);
    onClose();
  }, [navigate, onClose, editorIsOpen, minimizeEditor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selectedIndex, handleSelect, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-parchment-300">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-parchment-200">
          <Search className="w-5 h-5 text-ink-200 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Rechercher personnage, lieu, carte, paramètres..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-ink-500 placeholder-ink-200"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-ink-200 bg-parchment-100 rounded border border-parchment-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-ink-200">
              Aucun résultat pour "{query}"
            </div>
          )}
          {results.map((result, i) => {
            const Icon = TYPE_ICONS[result.type];
            return (
              <div
                key={`${result.type}-${result.id}`}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  i === selectedIndex ? 'bg-parchment-100' : 'hover:bg-parchment-50'
                }`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="w-8 h-8 rounded-lg bg-parchment-200 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-ink-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-500 truncate">{result.title}</div>
                  {result.subtitle && (
                    <div className="text-xs text-ink-200 truncate">{result.subtitle}</div>
                  )}
                </div>
                <span className="text-[10px] text-ink-200 bg-parchment-100 px-1.5 py-0.5 rounded">
                  {TYPE_LABELS[result.type]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-parchment-200 flex items-center gap-4 text-[10px] text-ink-200">
            <span><kbd className="font-mono bg-parchment-100 px-1 rounded">↑↓</kbd> naviguer</span>
            <span><kbd className="font-mono bg-parchment-100 px-1 rounded">↵</kbd> ouvrir</span>
            <span><kbd className="font-mono bg-parchment-100 px-1 rounded">esc</kbd> fermer</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function useSearchShortcut() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
