import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
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

export default function App() {
  return <RouterProvider router={router} />;
}
