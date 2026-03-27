import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SearchDialog, useSearchShortcut } from './SearchDialog';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useBookStore } from '@/store/useBookStore';

export function AppShell() {
  const { open, setOpen } = useSearchShortcut();
  const navigate = useNavigate();
  const currentBookId = useLibraryStore((s) => s.currentBookId);
  const loaded = useBookStore((s) => s._loaded);
  const loadBook = useBookStore((s) => s.loadBook);

  // If we have a currentBookId but book isn't loaded yet, load it
  useEffect(() => {
    if (currentBookId && !loaded) {
      loadBook(currentBookId);
    }
  }, [currentBookId, loaded, loadBook]);

  // If no book selected, redirect to home
  useEffect(() => {
    if (!currentBookId) {
      navigate('/', { replace: true });
    }
  }, [currentBookId, navigate]);

  if (!currentBookId) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar onSearchClick={() => setOpen(true)} />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <SearchDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
