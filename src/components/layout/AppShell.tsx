import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SearchDialog, useSearchShortcut } from './SearchDialog';

export function AppShell() {
  const { open, setOpen } = useSearchShortcut();

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
