import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { PasswordInput } from '@/components/shared/PasswordInput';

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (!token) {
      setError('Lien invalide');
      return;
    }

    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
      setTimeout(() => { window.location.href = '/'; }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
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
          <h1 className="text-4xl text-ink-500" style={{ fontFamily: "'Ephesis', cursive" }}>Fabula Mea</h1>
          <p className="text-ink-300 mt-1 text-sm">Nouveau mot de passe</p>
        </div>

        <div className="card-fantasy p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="font-display text-xl font-semibold text-ink-500">Mot de passe modifié</h2>
              <p className="text-ink-300 text-sm">
                Votre mot de passe a été mis à jour. Vous allez être redirigé vers la connexion…
              </p>
              <a href="/" className="btn-primary inline-block mt-2 px-6 py-2.5 text-sm">
                Se connecter
              </a>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold text-ink-500 mb-2">Choisir un nouveau mot de passe</h2>
              <p className="text-ink-300 text-sm mb-6">Minimum 8 caractères.</p>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label-field">Nouveau mot de passe</label>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    required
                    minLength={8}
                    autoFocus
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="label-field">Confirmer le mot de passe</label>
                  <PasswordInput
                    value={confirm}
                    onChange={setConfirm}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
