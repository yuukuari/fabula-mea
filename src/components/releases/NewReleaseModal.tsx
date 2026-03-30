import { useReleaseStore } from '@/store/useReleaseStore';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles } from 'lucide-react';

export function NewReleaseModal() {
  const { showNewReleaseModal, newRelease, dismissNewRelease } = useReleaseStore();
  const navigate = useNavigate();

  if (!showNewReleaseModal || !newRelease) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={dismissNewRelease} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 text-center">
        <button
          onClick={dismissNewRelease}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-300 hover:bg-parchment-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-green-600" />
        </div>

        <h2 className="text-xl font-display font-bold text-ink-500 mb-2">
          Nouvelle version disponible !
        </h2>
        <p className="text-3xl font-display font-bold text-bordeaux-500 mb-3">
          v{newRelease.version}
        </p>
        {newRelease.title && (
          <h3 className="text-sm font-medium text-ink-400 mb-2">{newRelease.title}</h3>
        )}
        {newRelease.description && (
          <div
            className="prose prose-sm max-w-none text-ink-300 mb-4"
            dangerouslySetInnerHTML={{ __html: newRelease.description }}
          />
        )}

        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={() => {
              dismissNewRelease();
              navigate('/releases');
            }}
            className="btn-primary"
          >
            Voir les détails
          </button>
          <button
            onClick={dismissNewRelease}
            className="btn-secondary"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
