import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Users, MapPin, BookOpen, Clock, Target, Globe, Settings, Feather, Search, ChevronDown, ChevronUp, ChevronRight, X, Map, Cloud, CloudOff, CloudAlert, Loader2, LogOut, Shield, MessageSquare, MessageSquarePlus, Tag, Eye, Lightbulb, BookMarked, ScrollText, HelpCircle, Plus, List, Compass, LayoutDashboard, FileText, Library, UserCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useBookStore } from '@/store/useBookStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useSyncStore } from '@/store/useSyncStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useReviewStore } from '@/store/useReviewStore';
import { useTicketFormStore } from '@/store/useTicketFormStore';
import { useReleaseStore } from '@/store/useReleaseStore';


interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  basePaths: string[];
  items: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Encyclopédie',
    icon: Compass,
    basePaths: ['/characters', '/places', '/maps', '/world'],
    items: [
      { to: '/characters', icon: Users, label: 'Personnages' },
      { to: '/places', icon: MapPin, label: 'Lieux' },
      { to: '/maps', icon: Map, label: 'Cartes' },
      { to: '/world', icon: Globe, label: 'Univers & Glossaire' },
    ],
  },
  {
    label: 'Manuscrit',
    icon: ScrollText,
    basePaths: ['/chapters', '/timeline', '/progress', '/reviews', '/edition'],
    items: [
      { to: '/timeline', icon: Clock, label: 'Chronologie' },
      { to: '/chapters', icon: BookOpen, label: 'Chapitres' },
      { to: '/progress', icon: Target, label: 'Avancement' },
      { to: '/reviews', icon: Eye, label: 'Relectures' },
      { to: '/edition', icon: FileText, label: 'Édition' },
    ],
  },
];

const directNavItems = [
  { to: '/notes', icon: Lightbulb, label: 'Notes & Idées' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
];

const supportGroup = {
  label: 'Aide & Support',
  icon: HelpCircle,
  basePaths: ['/tickets', '/releases'],
  items: [
    { to: '/releases', icon: Tag, label: 'Versions' },
    { to: '/tickets', icon: List, label: 'Tickets' },
  ],
};

interface SidebarProps {
  onSearchClick?: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ onSearchClick, mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const bookTitle = useBookStore((s) => s.title);
  const sagaId = useBookStore((s) => s.sagaId);
  const books = useLibraryStore((s) => s.books);
  const sagas = useLibraryStore((s) => s.sagas);
  const currentBookId = useLibraryStore((s) => s.currentBookId);
  const selectBook = useLibraryStore((s) => s.selectBook);
  const loadBook = useBookStore((s) => s.loadBook);
  const unloadBook = useBookStore((s) => s.unloadBook);
  const openTicketForm = useTicketFormStore((s) => s.show);
  const releases = useReleaseStore((s) => s.releases);
  const loadReleases = useReleaseStore((s) => s.loadReleases);
  const currentRelease = releases.find((r) => r.status === 'current');

  useEffect(() => {
    if (releases.length === 0) loadReleases();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [showSwitcher, setShowSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Collapsible group state — auto-expand group whose route is active
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const group of navGroups) {
      if (group.basePaths.some((p) => location.pathname.startsWith(p))) {
        initial.add(group.label);
      }
    }
    if (supportGroup.basePaths.some((p) => location.pathname.startsWith(p))) {
      initial.add(supportGroup.label);
    }
    return initial;
  });

  // Auto-expand when route changes
  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      for (const group of navGroups) {
        if (group.basePaths.some((p) => location.pathname.startsWith(p))) {
          next.add(group.label);
        }
      }
      if (supportGroup.basePaths.some((p) => location.pathname.startsWith(p))) {
        next.add(supportGroup.label);
      }
      return next;
    });
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Load review sessions for sidebar badge
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const reviewSessions = useReviewStore((s) => s.sessions);
  const loadReviewSessions = useReviewStore((s) => s.loadSessions);

  useEffect(() => {
    if (user) loadReviewSessions();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPendingComments = reviewSessions.reduce(
    (sum, s) => s.status === 'closed' ? sum : sum + (s.pendingCommentsCount ?? 0),
    0
  );

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
    navigate('/encyclopedia');
    onMobileClose();
  };

  const otherBooks = books.filter((b) => b.id !== currentBookId);

  const sidebarContent = (
    <aside className="w-72 h-screen bg-parchment-50 border-r border-parchment-300 flex flex-col overflow-hidden">
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
            <h1 className="text-2xl text-ink-500 leading-tight" style={{ fontFamily: "'Ephesis', cursive" }}>Fabula Mea</h1>
          </div>
        </button>
        {/* Close button — mobile only */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-lg text-ink-300 hover:bg-parchment-200"
          aria-label="Fermer le menu"
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
          <div className="flex-1 min-w-0">
            {sagaId && (() => {
              const saga = sagas.find((s) => s.id === sagaId);
              return saga ? <span className="block text-[10px] leading-tight text-bordeaux-400 truncate">{saga.title}</span> : null;
            })()}
            <span className="block truncate font-medium">{bookTitle || 'Sans titre'}</span>
          </div>
          <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform', showSwitcher && 'rotate-180')} />
        </button>

        {showSwitcher && (
          <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-white rounded-lg border border-parchment-300 shadow-lg overflow-hidden">
            {otherBooks.length > 0 ? (
              <div className="max-h-48 overflow-y-auto">
                {(() => {
                  const sagaBooks: Record<string, typeof otherBooks> = {};
                  const standalone: typeof otherBooks = [];

                  otherBooks.forEach((book) => {
                    if (book.sagaId) {
                      if (!sagaBooks[book.sagaId]) sagaBooks[book.sagaId] = [];
                      sagaBooks[book.sagaId].push(book);
                    } else {
                      standalone.push(book);
                    }
                  });

                  const sagaEntries = Object.entries(sagaBooks);

                  return (
                    <>
                      {sagaEntries.map(([sId, sBooks]) => {
                        const saga = sagas.find((s) => s.id === sId);
                        return (
                          <div key={sId}>
                            <div className="px-3 py-1.5 text-xs font-semibold text-ink-200 uppercase tracking-wide flex items-center gap-1.5 bg-parchment-50">
                              <Library className="w-3 h-3" />
                              {saga?.title || 'Saga'}
                            </div>
                            {sBooks.map((book) => (
                              <button
                                key={book.id}
                                onClick={() => handleSwitchBook(book.id)}
                                className="w-full flex items-center gap-2 px-3 pl-6 py-2 text-sm text-ink-400
                                           hover:bg-parchment-100 transition-colors text-left border-b border-parchment-100 last:border-0"
                              >
                                <BookOpen className="w-3.5 h-3.5 text-ink-200 flex-shrink-0" />
                                <span className="truncate">{book.title}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                      {standalone.length > 0 && sagaEntries.length > 0 && (
                        <div className="px-3 py-1.5 text-xs font-semibold text-ink-200 uppercase tracking-wide bg-parchment-50">
                          Livres indépendants
                        </div>
                      )}
                      {standalone.map((book) => (
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
                    </>
                  );
                })()}
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
        {/* Dashboard — top-level link */}
        <NavLink
          to="/encyclopedia"
          onClick={onMobileClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-parchment-200 text-bordeaux-500'
                : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
            )
          }
          aria-current={location.pathname === '/encyclopedia' ? 'page' : undefined}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Vue d'ensemble</span>
        </NavLink>

        <div className="h-px bg-parchment-200 my-2" />

        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const isExpanded = expandedGroups.has(group.label);
          const isGroupActive = group.basePaths.some((p) => location.pathname.startsWith(p));
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isGroupActive ? 'text-bordeaux-500' : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
                )}
              >
                <GroupIcon className="w-5 h-5" />
                <span className="flex-1 text-left">{group.label}</span>
                {group.label === 'Encyclopédie' && sagaId && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-bordeaux-400 bg-bordeaux-50 px-1.5 py-0.5 rounded-full shrink-0">
                    <Library className="w-3 h-3" />
                    Saga
                  </span>
                )}
                <ChevronRight className={cn('w-4 h-4 shrink-0 transition-transform duration-200', isExpanded && 'rotate-90')} />
              </button>
              {isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {group.items.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={onMobileClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                          'text-ink-300 hover:bg-parchment-200 hover:text-ink-500',
                          isActive && 'bg-parchment-200 text-bordeaux-500 border-l-[3px] border-bordeaux-500'
                        )
                      }
                      aria-current={location.pathname === to ? 'page' : undefined}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                      {to === '/reviews' && totalPendingComments > 0 && (
                        <span className="ml-auto text-[10px] font-bold bg-bordeaux-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                          {totalPendingComments}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {directNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onMobileClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                isActive ? 'text-bordeaux-500' : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
              )
            }
            aria-current={location.pathname === to ? 'page' : undefined}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="h-px bg-parchment-200 my-2" />

        {/* Profil */}
        <NavLink
          to="/profile"
          onClick={onMobileClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive ? 'text-bordeaux-500' : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
            )
          }
          aria-current={location.pathname === '/profile' ? 'page' : undefined}
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
              style={user.avatarOffsetY != null ? { objectPosition: `center ${user.avatarOffsetY}%` } : undefined}
            />
          ) : (
            <UserCircle className="w-5 h-5" />
          )}
          <span>Profil</span>
        </NavLink>

        <div className="h-px bg-parchment-200 my-2" />

        {/* Support group */}
        {(() => {
          const GroupIcon = supportGroup.icon;
          const isExpanded = expandedGroups.has(supportGroup.label);
          const isGroupActive = supportGroup.basePaths.some((p) => location.pathname.startsWith(p));
          return (
            <div>
              <button
                onClick={() => toggleGroup(supportGroup.label)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isGroupActive ? 'text-bordeaux-500' : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
                )}
              >
                <GroupIcon className="w-5 h-5" />
                <span className="flex-1 text-left">{supportGroup.label}</span>
                <ChevronRight className={cn('w-4 h-4 transition-transform duration-200', isExpanded && 'rotate-90')} />
              </button>
              {isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {supportGroup.items.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={onMobileClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                          'text-ink-300 hover:bg-parchment-200 hover:text-ink-500',
                          isActive && 'bg-parchment-200 text-bordeaux-500 border-l-[3px] border-bordeaux-500'
                        )
                      }
                      aria-current={location.pathname === to ? 'page' : undefined}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1">{label}</span>
                      {label === 'Versions' && currentRelease && (
                        <span className="text-[10px] font-semibold text-ink-200 bg-parchment-200 px-1.5 py-0.5 rounded-full">
                          v{currentRelease.version}
                        </span>
                      )}
                    </NavLink>
                  ))}
                  <button
                    onClick={() => { openTicketForm(); onMobileClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                               bg-bordeaux-50 text-bordeaux-600 hover:bg-bordeaux-100 border border-bordeaux-200"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Créer un ticket</span>
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </nav>

      <div className="px-4 py-3 border-t border-parchment-300 flex items-center">
        <div className="flex-1">
          <CompactSyncStatus />
        </div>
        <button
          onClick={logout}
          title="Se déconnecter"
          className="p-1 rounded text-ink-200 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div className="hidden md:flex fixed inset-y-0 left-0 z-30">
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

function CompactSyncStatus() {
  const lastSaved = useBookStore((s) => s.lastSavedAt);
  const { status } = useSyncStore();

  if (status === 'syncing') return (
    <div className="flex items-center gap-2 text-xs text-blue-400">
      <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
      <span>Synchronisation...</span>
    </div>
  );
  if (status === 'synced') return (
    <div className="flex items-center gap-2 text-xs text-green-400">
      <Cloud className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Sauvegardé</span>
    </div>
  );
  if (status === 'error') return (
    <div className="flex items-center gap-2 text-xs text-amber-400">
      <CloudAlert className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Erreur de sync</span>
    </div>
  );
  if (status === 'disabled') return (
    <div className="flex items-center gap-2 text-xs text-ink-200">
      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
      <span>{lastSaved ? 'Sauvegarde auto' : 'Non sauvegardé'}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 text-xs text-ink-200">
      <CloudOff className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Hors ligne</span>
    </div>
  );
}
