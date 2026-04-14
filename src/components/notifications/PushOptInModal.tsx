import { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { subscribeToPush } from '@/lib/push';

const DISMISS_KEY = 'emlb-push-optin-dismissed';

/**
 * Check if we should show the push opt-in prompt.
 * Returns true if:
 * - Push is supported by the browser
 * - Permission is not yet granted (or denied)
 * - User hasn't dismissed the prompt before
 */
export function shouldPromptPushOptIn(): boolean {
  if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return false;
  }
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (dismissed) {
    // Re-prompt after 7 days
    const dismissedAt = new Date(dismissed).getTime();
    if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PushOptInModal({ open, onClose }: Props) {
  const [subscribing, setSubscribing] = useState(false);

  if (!open) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    onClose();
  };

  const handleEnable = async () => {
    setSubscribing(true);
    await subscribeToPush();
    setSubscribing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleDismiss} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 text-center">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-300 hover:bg-parchment-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 bg-bordeaux-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <BellRing className="w-8 h-8 text-bordeaux-500" />
        </div>

        <h2 className="text-xl font-display font-bold text-ink-500 mb-2">
          Restez informé en temps réel
        </h2>
        <p className="text-sm text-ink-300 mb-1">
          Activez les notifications pour ne rien manquer :
        </p>
        <ul className="text-sm text-ink-400 text-left mx-auto max-w-xs space-y-1.5 my-4">
          <li className="flex items-start gap-2">
            <span className="text-bordeaux-400 mt-0.5">&#8226;</span>
            <span>Réponses à vos tickets et commentaires</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-bordeaux-400 mt-0.5">&#8226;</span>
            <span>Commentaires de vos relecteurs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-bordeaux-400 mt-0.5">&#8226;</span>
            <span>Relectures terminées</span>
          </li>
        </ul>
        <p className="text-xs text-ink-200 mb-6">
          Vous pourrez les désactiver à tout moment depuis les paramètres de votre navigateur.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleEnable}
            disabled={subscribing}
            className="btn-primary flex items-center gap-2"
          >
            <BellRing className="w-4 h-4" />
            {subscribing ? 'Activation...' : 'Activer les notifications'}
          </button>
          <button
            onClick={handleDismiss}
            className="btn-secondary"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
