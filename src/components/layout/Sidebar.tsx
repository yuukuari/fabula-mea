import { NavLink } from 'react-router-dom';
import { Users, MapPin, BookOpen, Clock, Target, Globe, Settings, Feather, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBookStore } from '@/store/useBookStore';

const navItems = [
  { to: '/characters', icon: Users, label: 'Personnages' },
  { to: '/places', icon: MapPin, label: 'Lieux' },
  { to: '/chapters', icon: BookOpen, label: 'Chapitres' },
  { to: '/timeline', icon: Clock, label: 'Chronologie' },
  { to: '/progress', icon: Target, label: 'Avancement' },
  { to: '/world', icon: Globe, label: 'Univers' },
  { to: '/settings', icon: Settings, label: 'Parametres' },
];

export function Sidebar({ onSearchClick }: { onSearchClick?: () => void }) {
  return (
    <aside className="w-64 min-h-screen bg-parchment-50 border-r border-parchment-300 flex flex-col">
      <div className="p-6 border-b border-parchment-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-bordeaux-500 rounded-lg flex items-center justify-center">
            <Feather className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-ink-500 leading-tight">
              Ecrire
            </h1>
            <p className="text-xs text-ink-300">Mon Livre</p>
          </div>
        </div>
      </div>

      {/* Search button */}
      <div className="px-4 pt-4">
        <button
          onClick={onSearchClick}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-200 bg-parchment-100 rounded-lg
                     border border-parchment-200 hover:border-gold-400 hover:text-ink-300 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Rechercher...</span>
          <kbd className="ml-auto text-[10px] font-mono bg-parchment-200 px-1 rounded">⌘K</kbd>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'sidebar-link',
                isActive && 'sidebar-link-active'
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-parchment-300">
        <AutoSaveIndicator />
      </div>
    </aside>
  );
}

function AutoSaveIndicator() {
  const lastSaved = useBookStore((s) => s.lastSavedAt);

  return (
    <div className="flex items-center gap-2 text-xs text-ink-200">
      <div className="w-2 h-2 rounded-full bg-green-400" />
      <span>
        {lastSaved
          ? `Sauvegarde auto`
          : 'Non sauvegarde'}
      </span>
    </div>
  );
}
