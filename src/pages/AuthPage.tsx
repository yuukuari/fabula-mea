import { useState, useEffect } from 'react';
import { BookOpen, Eye, EyeOff, AlertCircle, Database } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/api';
import type { BookMeta } from '@/types';

// ─── Detect existing anonymous local data ───────────────────────────────────

// Flag set after first successful sync — avoids showing the banner after logout/re-login
const LOCAL_SYNCED_KEY = 'emlb-local-synced';

function getLocalLibrary(): BookMeta[] | null {
  // Already synced once → no need to migrate again
  if (localStorage.getItem(LOCAL_SYNCED_KEY)) return null;
  try {
    const raw = localStorage.getItem('fabula-mea-library');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { books?: BookMeta[] } };
    const books = parsed?.state?.books ?? [];
    return books.length > 0 ? books : null;
  } catch {
    return null;
  }
}

function getLocalBookData(bookIds: string[]): { id: string; data: unknown }[] {
  return bookIds.flatMap((id) => {
    const raw = localStorage.getItem(`fabula-mea-book-${id}`);
    if (!raw) return [];
    try {
      return [{ id, data: JSON.parse(raw) }];
    } catch {
      return [];
    }
  });
}

// ─── AuthPage ────────────────────────────────────────────────────────────────

export function AuthPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const { login, signup, isLoading, error, clearError } = useAuthStore();
  const localBooks = getLocalLibrary();
  const hasLocalData = localBooks !== null;

  useEffect(() => { clearError(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const migrateLocalData = async (books: BookMeta[]) => {
    setMigrating(true);
    try {
      const bookData = getLocalBookData(books.map((b) => b.id));
      await api.books.migrate({ library: books, books: bookData });
    } catch {
      // Silent — local data still accessible
    } finally {
      setMigrating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, name.trim() || undefined);
      }
      // After successful auth, migrate existing local data (only first time)
      if (hasLocalData && localBooks) {
        await migrateLocalData(localBooks);
      }
      // Mark local data as synced — won't show migration banner on next logout/login
      localStorage.setItem(LOCAL_SYNCED_KEY, '1');

      // Redirect to intended page if any
      const redirect = sessionStorage.getItem('emlb-redirect-after-login');
      if (redirect) {
        sessionStorage.removeItem('emlb-redirect-after-login');
        window.location.href = redirect;
      }
    } catch {
      // Error already set in store
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-parchment-100 to-parchment-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-bordeaux-600 rounded-2xl mb-4 shadow-lg">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-ink-500">Fabula Mea</h1>
          <p className="text-ink-300 mt-1 text-sm">Votre atelier d'écriture personnel</p>
        </div>

        <div className="card-fantasy p-8">

          {/* Tabs */}
          <div className="flex rounded-lg bg-parchment-100 p-1 mb-6">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === t
                    ? 'bg-white text-ink-500 shadow-sm'
                    : 'text-ink-300 hover:text-ink-400'
                }`}
              >
                {t === 'login' ? 'Se connecter' : 'Créer un compte'}
              </button>
            ))}
          </div>

          {/* Migration notice */}
          {hasLocalData && (
            <div className="flex items-start gap-3 bg-gold-50 border border-gold-200 rounded-xl p-4 mb-5">
              <Database className="w-5 h-5 text-gold-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-gold-800">Données locales détectées</p>
                <p className="text-gold-600 mt-0.5">
                  {localBooks!.length} livre{localBooks!.length > 1 ? 's' : ''} trouvé{localBooks!.length > 1 ? 's' : ''}.
                  {' '}Ils seront automatiquement rattachés à votre compte.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label className="label-field">Nom d'affichage</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Votre nom ou pseudo"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="label-field">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="vous@exemple.fr"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label className="label-field">
                Mot de passe{tab === 'signup' && <span className="text-ink-200 font-normal"> (min. 8 caractères)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  required
                  minLength={tab === 'signup' ? 8 : undefined}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-200 hover:text-ink-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || migrating}
              className="btn-primary w-full py-2.5 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {migrating
                ? 'Migration des données…'
                : isLoading
                  ? 'Chargement…'
                  : tab === 'login'
                    ? 'Se connecter'
                    : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-200 mt-6">
          Vos données sont stockées de façon sécurisée et accessibles depuis n'importe quel appareil.
        </p>
      </div>
    </div>
  );
}
