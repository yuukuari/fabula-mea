import { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomeShell } from '@/components/layout/HomeShell';
import { HomePage } from '@/pages/HomePage';
import { EncyclopediaPage } from '@/pages/EncyclopediaPage';
import { CharactersPage } from '@/pages/CharactersPage';
import { PlacesPage } from '@/pages/PlacesPage';
import { ChaptersPage } from '@/pages/ChaptersPage';
import { TimelinePage } from '@/pages/TimelinePage';
import { ProgressionPage } from '@/pages/ProgressionPage';
import { ObjectifsPage } from '@/pages/ObjectifsPage';
import { WorldPage } from '@/pages/WorldPage';
import { MapsPage } from '@/pages/MapsPage';
import { NotesIdeasPage } from '@/pages/NotesIdeasPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { EditionOverviewPage } from '@/pages/edition/EditionOverviewPage';
import { EditionLayoutPage } from '@/pages/edition/EditionLayoutPage';
import { EditionCoversPage } from '@/pages/edition/EditionCoversPage';
import { EditionPrintPage } from '@/pages/edition/EditionPrintPage';
import { EditionDigitalPage } from '@/pages/edition/EditionDigitalPage';
import { EditionExportPage } from '@/pages/edition/EditionExportPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AuthPage } from '@/pages/AuthPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { ReleaseNotesPage } from '@/pages/ReleaseNotesPage';
import { ReviewsPage } from '@/pages/ReviewsPage';
import { ReviewAuthorView } from '@/pages/reviews/ReviewAuthorView';
import { ReviewReaderPage } from '@/pages/review/ReviewReaderPage';
import { SagaPage } from '@/pages/SagaPage';
import { SpotifyCallbackPage } from '@/pages/SpotifyCallbackPage';
import { GenealogyPage } from '@/components/genealogy/GenealogyPage';
import { AdminMembersPage } from '@/pages/admin/AdminMembersPage';
import { AdminUserDetailPage } from '@/pages/admin/AdminUserDetailPage';
import { AdminReleasesPage } from '@/pages/admin/AdminReleasesPage';
import { TicketForm } from '@/components/tickets/TicketForm';
import { NewReleaseModal } from '@/components/releases/NewReleaseModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useTicketFormStore } from '@/store/useTicketFormStore';
import { useLibraryStore } from '@/store/useLibraryStore';

/** Root layout — renders global overlays (ticket bubble, release footer, etc.) on every page */
function RootLayout() {
  const user = useAuthStore((s) => s.user);
  const ticketFormOpen = useTicketFormStore((s) => s.open);
  const hideTicketForm = useTicketFormStore((s) => s.hide);
  return (
    <>
      <Outlet />
      {user && <TicketForm open={ticketFormOpen} onClose={hideTicketForm} />}
      <NewReleaseModal />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password/:token', element: <ResetPasswordPage /> },
      { path: 'spotify-callback', element: <SpotifyCallbackPage /> },
      { path: 'review/:token', element: <ReviewReaderPage /> },
      { path: 'reviews/:id', element: <ReviewAuthorView /> },
      {
        element: <HomeShell />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: 'tickets', element: <TicketsPage /> },
          { path: 'releases', element: <ReleaseNotesPage /> },
          { path: 'admin/members', element: <AdminMembersPage /> },
          { path: 'admin/users/:id', element: <AdminUserDetailPage /> },
          { path: 'admin/releases', element: <AdminReleasesPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'saga/:sagaId', element: <SagaPage /> },
        ],
      },
      {
        element: <AppShell />,
        children: [
          { path: 'encyclopedia', element: <EncyclopediaPage /> },
          { path: 'characters', element: <CharactersPage /> },
          { path: 'characters/:id', element: <CharactersPage /> },
          { path: 'characters/:id/genealogy', element: <GenealogyPage /> },
          { path: 'places', element: <PlacesPage /> },
          { path: 'chapters', element: <ChaptersPage /> },
          { path: 'timeline', element: <TimelinePage /> },
          { path: 'progression', element: <ProgressionPage /> },
          { path: 'objectifs', element: <ObjectifsPage /> },
          { path: 'world', element: <WorldPage /> },
          { path: 'maps', element: <MapsPage /> },
          { path: 'notes', element: <NotesIdeasPage /> },
          { path: 'reviews', element: <ReviewsPage /> },
          { path: 'edition', element: <EditionOverviewPage /> },
          { path: 'edition/layout', element: <EditionLayoutPage /> },
          { path: 'edition/covers', element: <EditionCoversPage /> },
          { path: 'edition/print', element: <EditionPrintPage /> },
          { path: 'edition/digital', element: <EditionDigitalPage /> },
          { path: 'edition/export', element: <EditionExportPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
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

  // Public pages (no auth needed)
  if (!user && (
    window.location.pathname.startsWith('/review/') ||
    window.location.pathname === '/forgot-password' ||
    window.location.pathname.startsWith('/reset-password/') ||
    window.location.pathname === '/spotify-callback'
  )) {
    return <RouterProvider router={router} />;
  }

  // Auth required (both dev and production)
  if (!user) {
    // Save intended destination so we can redirect after login
    const intended = window.location.pathname + window.location.search;
    if (intended !== '/' && intended !== '/auth') {
      sessionStorage.setItem('emlb-redirect-after-login', intended);
    }
    return <AuthPage />;
  }

  return <RouterProvider router={router} />;
}
