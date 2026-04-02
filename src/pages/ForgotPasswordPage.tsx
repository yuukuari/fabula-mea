import { useState } from 'react';
import { BookOpen, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.auth.requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
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
          <p className="text-ink-300 mt-1 text-sm">Réinitialisation du mot de passe</p>
        </div>

        <div className="card-fantasy p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="font-display text-xl font-semibold text-ink-500">Email envoyé</h2>
              <p className="text-ink-300 text-sm leading-relaxed">
                Si l'adresse <strong>{email}</strong> est associée à un compte, vous recevrez un lien de réinitialisation dans quelques instants.
              </p>
              <p className="text-ink-200 text-xs">
                Le lien est valable 10 minutes. Pensez à vérifier vos spams.
              </p>
              <a
                href="/"
                className="inline-flex items-center gap-2 text-bordeaux-600 hover:text-bordeaux-700 text-sm font-medium mt-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </a>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold text-ink-500 mb-2">Mot de passe oublié ?</h2>
              <p className="text-ink-300 text-sm mb-6 leading-relaxed">
                Saisissez votre adresse email. Vous recevrez un lien pour choisir un nouveau mot de passe.
              </p>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label-field">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="vous@exemple.fr"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <a
                  href="/"
                  className="inline-flex items-center gap-1.5 text-ink-300 hover:text-ink-500 text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour à la connexion
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
