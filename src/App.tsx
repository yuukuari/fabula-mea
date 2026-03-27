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
import { useAuthStore } from '@/store/useAuthStore';

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
    ],
  },
]);

const DEV_MODE = import.meta.env.DEV;

export default function App() {
  const { user, checkAuth } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // In dev mode (npm run dev / Vite only), skip auth — use localStorage directly
    if (DEV_MODE) {
      setAuthChecked(true);
      return;
    }
    checkAuth().finally(() => setAuthChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-parchment-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Dev mode: bypass auth entirely, localStorage only
  if (DEV_MODE) return <RouterProvider router={router} />;

  // Production: auth required
  if (!user) return <AuthPage />;

  return <RouterProvider router={router} />;
}
