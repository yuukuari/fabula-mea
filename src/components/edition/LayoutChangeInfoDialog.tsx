import { X, AlertTriangle } from 'lucide-react';

/** Modale d'information sur le changement de mise en page */
export function LayoutChangeInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost p-1">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-display font-bold text-ink-500">Changement de mise en page</h3>
            <p className="text-sm text-ink-300 mt-1">
              Ce paramètre s'applique au texte dont la police n'a pas été modifiée manuellement dans l'éditeur (texte « par défaut »).
            </p>
          </div>
        </div>
        <p className="text-sm text-ink-300 mb-5">
          Les passages auxquels vous avez appliqué une police spécifique dans l'éditeur conservent leur mise en forme individuelle.
          Pour uniformiser tout le texte, utilisez le bouton « Supprimer le formatage » dans l'éditeur de scènes.
        </p>
        <button onClick={onClose} className="w-full btn-primary">Compris</button>
      </div>
    </div>
  );
}
