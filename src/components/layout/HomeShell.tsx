import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { HomeSidebar } from './HomeSidebar';

export function HomeShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 min-h-0">
        <HomeSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0 md:ml-64">
          {/* Mobile top bar */}
          <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-parchment-50 border-b border-parchment-200 sticky top-0 z-30">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-ink-400 hover:bg-parchment-200 transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-2xl text-ink-500" style={{ fontFamily: "'Ephesis', cursive" }}>Fabula Mea</span>
          </header>

          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
