import { NavLink, useNavigate } from 'react-router-dom';
import { Users, MapPin, BookOpen, Clock, Target, Globe, Settings, Feather, Search, ChevronDown, ChevronUp, X, Map, Cloud, CloudOff, CloudAlert, Loader2, LogOut, UserCircle, Shield, MessageSquare, Tag } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useBookStore } from '@/store/useBookStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useSyncStore } from '@/store/useSyncStore';
import { useAuthStore } from '@/store/useAuthStore';
import { VersionBadge } from '@/components/releases/VersionBadge';

const navItems = [
  { to: '/characters', icon: Users, label: 'Personnages' },
  { to: '/places', icon: MapPin, label: 'Lieux' },
  { to: '/chapters', icon: BookOpen, label: 'Chapitres' },
  { to: '/timeline', icon: Clock, label: 'Chronologie' },
  { to: '/progress', icon: Target, label: 'Avancement' },
  { to: '/world', icon: Globe, label: 'Univers' },
  { to: '/maps', icon: Map, label: 'Cartes' },
  { to: '/settings', icon: Settings, label: 'Parametres' },
];

const adminItems = [
  { to: '/admin/members', icon: Users, label: 'Membres' },
  { to: '/admin/tickets', icon: MessageSquare, label: 'Tickets' },
  { to: '/admin/releases', icon: Tag, label: 'Releases' },
];

interface SidebarProps {
  onSearchClick?: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ onSearchClick, mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const bookTitle = useBookStore((s) => s.title);
  const books = useLibraryStore((s) => s.books);
  const currentBookId = useLibraryStore((s) => s.currentBookId);
  const selectBook = useLibraryStore((s) => s.selectBook);
  const loadBook = useBookStore((s) => s.loadBook);
  const unloadBook = useBookStore((s) => s.unloadBook);

  const [showSwitcher, setShowSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
      }
    };
    if (showSwitcher) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSwitcher]);

  const handleGoHome = () => {
    unloadBook();
    selectBook(null);
    navigate('/');
    onMobileClose();
  };

  const handleSwitchBook = (bookId: string) => {
    if (bookId === currentBookId) { setShowSwitcher(false); return; }
    selectBook(bookId);
    loadBook(bookId);
    setShowSwitcher(false);
    navigate('/characters');
    onMobileClose();
  };

  const otherBooks = books.filter((b) => b.id !== currentBookId);

  const sidebarContent = (
    <aside className="w-64 h-screen bg-parchment-50 border-r border-parchment-300 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-6 border-b border-parchment-300 flex items-center justify-between">
        <button
          onClick={handleGoHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          title="Retour a l'accueil"
        >
          <div className="w-10 h-10 bg-bordeaux-500 rounded-lg flex items-center justify-center">
            <Feather className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h1 className="font-display text-lg font-bold text-ink-500 leading-tight">Ecrire</h1>
            <p className="text-xs text-ink-300">Mon Livre</p>
          </div>
        </button>
        <VersionBadge />
        {/* Close button — mobile only */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-lg text-ink-300 hover:bg-parchment-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Book selector */}
      <div className="px-4 pt-4 relative" ref={switcherRef}>
        <button
          onClick={() => setShowSwitcher(!showSwitcher)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors text-left',
            'bg-bordeaux-50 border-bordeaux-200 text-bordeaux-600 hover:border-bordeaux-400'
          )}
        >
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 truncate font-medium">{bookTitle || 'Sans titre'}</span>
          <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform', showSwitcher && 'rotate-180')} />
        </button>

        {showSwitcher && (
          <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-white rounded-lg border border-parchment-300 shadow-lg overflow-hidden">
            {otherBooks.length > 0 ? (
              <div className="max-h-48 overflow-y-auto">
                {otherBooks.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => handleSwitchBook(book.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink-400
                               hover:bg-parchment-100 transition-colors text-left border-b border-parchment-100 last:border-0"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-ink-200 flex-shrink-0" />
                    <span className="truncate">{book.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-3 py-2.5 text-xs text-ink-200">Aucun autre livre</p>
            )}
            <button
              onClick={handleGoHome}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-bordeaux-500
                         hover:bg-bordeaux-50 transition-colors border-t border-parchment-200"
            >
              <span>Tous les livres</span>
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 pt-3">
        <button
          onClick={() => { onSearchClick?.(); onMobileClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-200 bg-parchment-100 rounded-lg
                     border border-parchment-200 hover:border-gold-400 hover:text-ink-300 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Rechercher...</span>
          <kbd className="ml-auto text-[10px] font-mono bg-parchment-200 px-1 rounded">⌘K</kbd>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onMobileClose}
            className={({ isActive }) =>
              cn('sidebar-link', isActive && 'sidebar-link-active')
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-parchment-300 space-y-3">
        <AutoSaveIndicator />
        <UserSection />
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: static sidebar */}
      <div className="hidden md:flex">
        {sidebarContent}
      </div>

      {/* Mobile: slide-in overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
          />
          {/* Panel */}
          <div className="relative flex h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

function AutoSaveIndicator() {
  const lastSaved = useBookStore((s) => s.lastSavedAt);
  const { status, errorMessage } = useSyncStore();

  const cloudIcon = () => {
    if (status === 'disabled') return null;
    if (status === 'syncing') return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />;
    if (status === 'synced')  return <Cloud className="w-3.5 h-3.5 text-green-400" />;
    if (status === 'error')   return <CloudAlert className="w-3.5 h-3.5 text-amber-400" />;
    return <CloudOff className="w-3.5 h-3.5 text-ink-200" />;
  };

  const cloudLabel = () => {
    if (status === 'disabled') return null;
    if (status === 'syncing') return <span className="text-blue-400">Synchro...</span>;
    if (status === 'synced')  return <span className="text-green-400">Cloud OK</span>;
    if (status === 'error')   return <span className="text-amber-400">Erreur sync</span>;
    return <span>Cloud</span>;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-ink-200">
        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
        <span>{lastSaved ? 'Sauvegarde auto' : 'Non sauvegardé'}</span>
      </div>
      {status !== 'disabled' && (
        <div className="flex items-center gap-2 text-xs text-ink-200">
          {cloudIcon()}
          {cloudLabel()}
        </div>
      )}
    </div>
  );
}

function UserSection() {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2 pt-1">
      <UserCircle className="w-4 h-4 text-ink-200 flex-shrink-0" />
      <span className="text-xs text-ink-300 truncate flex-1" title={user.email}>
        {user.name}
      </span>
      <button
        onClick={logout}
        title="Se déconnecter"
        className="p-1 rounded text-ink-200 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
