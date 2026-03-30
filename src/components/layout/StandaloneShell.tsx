import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Feather, ChevronLeft, Menu, X, LogOut, UserCircle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { VersionBadge } from '@/components/releases/VersionBadge';

/**
 * Lightweight shell for standalone pages (tickets, releases) when accessed
 * outside of a book or admin context. Shows a simple header with logo,
 * version badge, back button, and user info.
 */
export function StandaloneShell() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-parchment-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-parchment-300 bg-parchment-100/50 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Left: logo + version + back */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              title="Retour à l'accueil"
            >
              <div className="w-10 h-10 bg-bordeaux-500 rounded-lg flex items-center justify-center shadow">
                <Feather className="w-5 h-5 text-white" />
              </div>
              <div className="text-left hidden sm:block">
                <h1 className="font-display text-lg font-bold text-ink-500 leading-tight">
                  Ecrire Mon Livre
                </h1>
              </div>
            </button>
            <VersionBadge />
            <div className="w-px h-6 bg-parchment-300 hidden sm:block" />
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-sm text-ink-300 hover:text-ink-500 transition-colors hidden sm:flex"
            >
              <ChevronLeft className="w-4 h-4" />
              Mes livres
            </button>
          </div>

          {/* Right: user */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-ink-200" />
                <span className="text-xs text-ink-300 hidden sm:inline">{user.name}</span>
                <button
                  onClick={logout}
                  title="Se déconnecter"
                  className="p-1 rounded text-ink-200 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
