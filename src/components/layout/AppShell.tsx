import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { SearchDialog, useSearchShortcut } from './SearchDialog';
import { FloatingPomodoro } from '@/components/progress/FloatingPomodoro';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { SceneEditor } from '@/components/editor/SceneEditor';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useBookStore } from '@/store/useBookStore';

export function AppShell() {
  const { open, setOpen } = useSearchShortcut();
  const navigate = useNavigate();
  const currentBookId = useLibraryStore((s) => s.currentBookId);
  const loadFromCloud = useLibraryStore((s) => s.loadFromCloud);
  const loaded = useBookStore((s) => s._loaded);
  const loadBook = useBookStore((s) => s.loadBook);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Restaure la bibliothèque depuis Redis au démarrage (nouveau device ou nouvelle session)
  useEffect(() => {
    loadFromCloud();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentBookId && !loaded) loadBook(currentBookId);
  }, [currentBookId, loaded, loadBook]);

  useEffect(() => {
    if (!currentBookId) navigate('/', { replace: true });
  }, [currentBookId, navigate]);

  if (!currentBookId) return null;

  return (
    <div className="flex flex-col min-h-screen md:ml-64">
      <div className="flex flex-1 min-h-0">
        <Sidebar
          onSearchClick={() => setOpen(true)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

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
            <span className="font-display font-semibold text-ink-500 text-sm truncate">
              {useBookStore.getState().title || 'Mon Livre'}
            </span>
          </header>

          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>

      <SearchDialog open={open} onClose={() => setOpen(false)} />
      <FloatingPomodoro />
      {/* Full-screen scene editor */}
      <SceneEditor />
      {/* Floating editor tabs – fixed bottom center */}
      <EditorTabs />
    </div>
  );
}
