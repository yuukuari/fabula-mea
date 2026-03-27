import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, User, MapPin, BookOpen, FileText, Globe, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '@/store/useBookStore';
import { useEditorStore } from '@/store/useEditorStore';

interface SearchResult {
  type: 'character' | 'place' | 'chapter' | 'scene' | 'worldNote';
  id: string;
  title: string;
  subtitle?: string;
  navigateTo: string;
}

const TYPE_ICONS = {
  character: User,
  place: MapPin,
  chapter: BookOpen,
  scene: FileText,
  worldNote: Globe,
};

const TYPE_LABELS = {
  character: 'Personnage',
  place: 'Lieu',
  chapter: 'Chapitre',
  scene: 'Scene',
  worldNote: 'Note',
};

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const minimizeEditor = useEditorStore((s) => s.minimize);
  const editorIsOpen = useEditorStore((s) => s.isOpen);
  const characters = useBookStore((s) => s.characters);
  const places = useBookStore((s) => s.places);
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const worldNotes = useBookStore((s) => s.worldNotes);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const c of characters) {
      if (c.name.toLowerCase().includes(q) || c.surname?.toLowerCase().includes(q) || c.profession?.toLowerCase().includes(q)) {
        results.push({ type: 'character', id: c.id, title: `${c.name} ${c.surname ?? ''}`.trim(), subtitle: c.profession, navigateTo: `/characters/${c.id}` });
      }
    }
    for (const p of places) {
      if (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) {
        results.push({ type: 'place', id: p.id, title: p.name, subtitle: p.type, navigateTo: '/places' });
      }
    }
    for (const ch of chapters) {
      if (ch.title.toLowerCase().includes(q)) {
        results.push({ type: 'chapter', id: ch.id, title: `Ch. ${ch.number} - ${ch.title}`, navigateTo: '/chapters' });
      }
    }
    for (const sc of scenes) {
      if (sc.title.toLowerCase().includes(q) || sc.description.toLowerCase().includes(q)) {
        const ch = chapters.find((c) => c.id === sc.chapterId);
        results.push({ type: 'scene', id: sc.id, title: sc.title, subtitle: ch ? `Ch. ${ch.number}` : undefined, navigateTo: '/chapters' });
      }
    }
    for (const n of worldNotes) {
      if (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) {
        results.push({ type: 'worldNote', id: n.id, title: n.title, subtitle: n.category, navigateTo: '/world' });
      }
    }

    return results.slice(0, 15);
  }, [query, characters, places, chapters, scenes, worldNotes]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

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
            placeholder="Rechercher un personnage, lieu, scene..."
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
              Aucun resultat pour "{query}"
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
