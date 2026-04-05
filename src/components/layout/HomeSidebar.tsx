import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { BookMarked, Shield, Users, HelpCircle, Tag, List, Plus, UserCircle, Feather, X, ChevronRight, Cloud, CloudOff, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useTicketFormStore } from '@/store/useTicketFormStore';
import { useReleaseStore } from '@/store/useReleaseStore';

interface HomeSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function HomeSidebar({ mobileOpen, onMobileClose }: HomeSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const openTicketForm = useTicketFormStore((s) => s.show);
  const releases = useReleaseStore((s) => s.releases);
  const loadReleases = useReleaseStore((s) => s.loadReleases);
  const currentRelease = releases.find((r) => r.status === 'current');

  useEffect(() => {
    if (releases.length === 0) loadReleases();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (location.pathname.startsWith('/admin')) initial.add('admin');
    if (['/releases', '/tickets'].some((p) => location.pathname.startsWith(p))) initial.add('support');
    return initial;
  });

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (location.pathname.startsWith('/admin')) next.add('admin');
      if (['/releases', '/tickets'].some((p) => location.pathname.startsWith(p))) next.add('support');
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

  const sidebarContent = (
    <aside className="w-64 h-screen bg-parchment-50 border-r border-parchment-300 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-6 border-b border-parchment-300 flex items-center justify-between">
        <button
          onClick={() => { navigate('/'); onMobileClose(); }}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          title="Accueil"
        >
          <div className="w-10 h-10 bg-bordeaux-500 rounded-lg flex items-center justify-center">
            <Feather className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl text-ink-500 leading-tight" style={{ fontFamily: "'Ephesis', cursive" }}>
            Fabula Mea
          </h1>
        </button>
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-lg text-ink-300 hover:bg-parchment-200"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Livres */}
        <NavLink
          to="/"
          end
          onClick={onMobileClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-parchment-200 text-bordeaux-500'
                : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
            )
          }
          aria-current={location.pathname === '/' ? 'page' : undefined}
        >
          <BookMarked className="w-5 h-5" />
          <span>Livres</span>
        </NavLink>

        {/* Administration (admin only) */}
        {user?.isAdmin && (
          <div>
            <button
              onClick={() => toggleGroup('admin')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                location.pathname.startsWith('/admin') ? 'text-bordeaux-500' : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
              )}
            >
              <Shield className="w-5 h-5" />
              <span className="flex-1 text-left">Administration</span>
              <ChevronRight className={cn('w-4 h-4 transition-transform duration-200', expandedGroups.has('admin') && 'rotate-90')} />
            </button>
            {expandedGroups.has('admin') && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                <NavLink
                  to="/admin/members"
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      'text-ink-300 hover:bg-parchment-200 hover:text-ink-500',
                      isActive && 'bg-parchment-200 text-bordeaux-500 border-l-[3px] border-bordeaux-500'
                    )
                  }
                  aria-current={location.pathname === '/admin/members' ? 'page' : undefined}
                >
                  <Users className="w-4 h-4" />
                  <span>Membres</span>
                </NavLink>
                <NavLink
                  to="/admin/releases"
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      'text-ink-300 hover:bg-parchment-200 hover:text-ink-500',
                      isActive && 'bg-parchment-200 text-bordeaux-500 border-l-[3px] border-bordeaux-500'
                    )
                  }
                  aria-current={location.pathname === '/admin/releases' ? 'page' : undefined}
                >
                  <Tag className="w-4 h-4" />
                  <span>Versions</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        <div className="h-px bg-parchment-200 my-2" />

        {/* Profil */}
        <NavLink
          to="/profile"
          onClick={onMobileClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-parchment-200 text-bordeaux-500'
                : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
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

        {/* Aide & Support */}
        <div>
          <button
            onClick={() => toggleGroup('support')}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              ['/releases', '/tickets'].some((p) => location.pathname.startsWith(p))
                ? 'text-bordeaux-500'
                : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
            )}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="flex-1 text-left">Aide & Support</span>
            <ChevronRight className={cn('w-4 h-4 transition-transform duration-200', expandedGroups.has('support') && 'rotate-90')} />
          </button>
          {expandedGroups.has('support') && (
            <div className="ml-4 mt-0.5 space-y-0.5">
              <NavLink
                to="/releases"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    'text-ink-300 hover:bg-parchment-200 hover:text-ink-500',
                    isActive && 'bg-parchment-200 text-bordeaux-500 border-l-[3px] border-bordeaux-500'
                  )
                }
                aria-current={location.pathname === '/releases' ? 'page' : undefined}
              >
                <Tag className="w-4 h-4" />
                <span className="flex-1">Versions</span>
                {currentRelease && (
                  <span className="text-[10px] font-semibold text-ink-200 bg-parchment-200 px-1.5 py-0.5 rounded-full">
                    v{currentRelease.version}
                  </span>
                )}
              </NavLink>
              <NavLink
                to="/tickets"
                onClick={onMobileClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    'text-ink-300 hover:bg-parchment-200 hover:text-ink-500',
                    isActive && 'bg-parchment-200 text-bordeaux-500 border-l-[3px] border-bordeaux-500'
                  )
                }
                aria-current={location.pathname === '/tickets' ? 'page' : undefined}
              >
                <List className="w-4 h-4" />
                <span>Tickets</span>
              </NavLink>
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
      </nav>

      {/* Sync status + logout footer */}
      <div className="px-4 py-3 border-t border-parchment-300 flex items-center">
        <div className="flex-1">
          <HomeSyncStatus />
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
          <div className="absolute inset-0 bg-black/40" onClick={onMobileClose} />
          <div className="relative flex h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}

function HomeSyncStatus() {
  const token = !!localStorage.getItem('emlb-token');
  return (
    <div className="flex items-center gap-2 text-xs text-ink-200">
      {token ? (
        <>
          <Cloud className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          <span className="text-green-400">Connecté</span>
        </>
      ) : (
        <>
          <CloudOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Hors ligne</span>
        </>
      )}
    </div>
  );
}
