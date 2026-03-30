import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { CharactersPage } from '@/pages/CharactersPage';
import { PlacesPage } from '@/pages/PlacesPage';
import { ChaptersPage } from '@/pages/ChaptersPage';
import { TimelinePage } from '@/pages/TimelinePage';
import { ProgressPage } from '@/pages/ProgressPage';
import { WorldPage } from '@/pages/WorldPage';
import { MapsPage } from '@/pages/MapsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AuthPage } from '@/pages/AuthPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { ReleaseNotesPage } from '@/pages/ReleaseNotesPage';
import { AdminMembersPage } from '@/pages/admin/AdminMembersPage';
import { AdminReleasesPage } from '@/pages/admin/AdminReleasesPage';
import { useAuthStore } from '@/store/useAuthStore';
import { useLibraryStore } from '@/store/useLibraryStore';

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  {
    element: <AppShell />,
    children: [
      { path: 'characters', element: <CharactersPage /> },
      { path: 'characters/:id', element: <CharactersPage /> },
      { path: 'places', element: <PlacesPage /> },
      { path: 'chapters', element: <ChaptersPage /> },
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'world', element: <WorldPage /> },
      { path: 'maps', element: <MapsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'releases', element: <ReleaseNotesPage /> },
      { path: 'admin/members', element: <AdminMembersPage /> },
      { path: 'admin/tickets', element: <TicketsPage /> },
      { path: 'admin/releases', element: <AdminReleasesPage /> },
    ],
  },
]);

export default function App() {
  const { user, checkAuth } = useAuthStore();
  const loadFromCloud = useLibraryStore((s) => s.loadFromCloud);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth()
      .then(() => loadFromCloud())
      .finally(() => setAuthChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After login (user goes from null → object), load the library
  useEffect(() => {
    if (user && authChecked) {
      loadFromCloud();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-parchment-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Auth required (both dev and production)
  if (!user) return <AuthPage />;

  return <RouterProvider router={router} />;
}
