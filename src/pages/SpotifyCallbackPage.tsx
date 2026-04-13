import { useEffect, useRef } from 'react';
import { exchangeCodeForTokens } from '@/lib/spotify';

/**
 * OAuth callback page — opened in a popup by the Spotify auth flow.
 * Extracts the code, exchanges it for tokens, notifies the opener, and closes.
 */
export function SpotifyCallbackPage() {
  // Guard against React StrictMode double-execution
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error || !code) {
      if (window.opener) {
        window.opener.postMessage({ type: 'spotify-callback', error: error || 'no_code' }, window.location.origin);
      }
      window.close();
      return;
    }

    exchangeCodeForTokens(code)
      .then((tokens) => {
        if (window.opener) {
          window.opener.postMessage(
            { type: 'spotify-callback', accessToken: tokens.accessToken },
            window.location.origin,
          );
        }
        window.close();
      })
      .catch(() => {
        if (window.opener) {
          window.opener.postMessage({ type: 'spotify-callback', error: 'token_exchange_failed' }, window.location.origin);
        }
        window.close();
      });
  }, []);

  return (
    <div className="min-h-screen bg-parchment-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-ink-300">Connexion à Spotify en cours...</p>
      </div>
    </div>
  );
}
