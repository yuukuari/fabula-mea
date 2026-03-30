import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Tag, Feather, Menu, X, Shield, ChevronLeft, LogOut, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { VersionBadge } from '@/components/releases/VersionBadge';

const adminNavItems = [
  { to: '/admin/members', icon: Users, label: 'Membres' },
  { to: '/admin/tickets', icon: MessageSquare, label: 'Tickets' },
  { to: '/admin/releases', icon: Tag, label: 'Releases' },
];

export function AdminShell() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user?.isAdmin) {
    navigate('/', { replace: true });
    return null;
  }

  const sidebarContent = (
    <aside className="w-64 h-screen bg-parchment-50 border-r border-parchment-300 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-parchment-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-bordeaux-500 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h1 className="font-display text-lg font-bold text-ink-500 leading-tight">Admin</h1>
            <p className="text-xs text-ink-300">Ecrire Mon Livre</p>
          </div>
          <VersionBadge />
        </div>
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-ink-300 hover:bg-parchment-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Back button */}
      <div className="px-4 pt-4">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-parchment-100 border-parchment-200 text-ink-300 hover:border-gold-400 hover:text-ink-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Retour à l'accueil</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {adminNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200',
                isActive
                  ? 'bg-bordeaux-50 text-bordeaux-500 font-medium shadow-sm'
                  : 'text-ink-300 hover:bg-parchment-200 hover:text-ink-500'
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-parchment-300">
        <div className="flex items-center gap-2">
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
      </div>
    </aside>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">{sidebarContent}</div>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex h-full">{sidebarContent}</div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar */}
          <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-parchment-50 border-b border-parchment-200 sticky top-0 z-30">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-ink-400 hover:bg-parchment-200 transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display font-semibold text-ink-500 text-sm">Administration</span>
          </header>

          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
