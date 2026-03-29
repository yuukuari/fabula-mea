import { useRef, useState } from 'react';
import { Download, Upload, Hash, PenLine, AlertTriangle, X, BookOpen, FileText } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { exportEpub } from '@/lib/export-epub';
import { exportPdf } from '@/lib/export-pdf';
import type { WritingMode } from '@/types';

/** Modale de confirmation de changement de mode */
function WritingModeChangeDialog({
  fromMode,
  toMode,
  onConfirm,
  onCancel,
}: {
  fromMode: WritingMode;
  toMode: WritingMode;
  onConfirm: (deleteContent: boolean) => void;
  onCancel: () => void;
}) {
  const isWriteToCount = fromMode === 'write' && toMode === 'count';
  const scenes = useBookStore((s) => s.scenes);
  const scenesWithContent = scenes.filter((s) => s.content && s.content !== '<p></p>').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 btn-ghost p-1">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-gold-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-ink-500">Changer le mode d'écriture</h3>
            <p className="text-sm text-ink-300 mt-1">
              {isWriteToCount
                ? `Vous passez du mode Écriture au mode Comptage.`
                : `Vous passez du mode Comptage au mode Écriture.`}
            </p>
          </div>
        </div>

        {isWriteToCount && scenesWithContent > 0 ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
              <strong>{scenesWithContent} scène{scenesWithContent > 1 ? 's' : ''}</strong> contiennent du texte rédigé dans l'application.
              Que souhaitez-vous faire de ces textes ?
            </div>
            <div className="space-y-3">
              <button
                onClick={() => onConfirm(false)}
                className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-parchment-200
                           hover:border-bordeaux-300 hover:bg-bordeaux-50/30 transition-all text-left"
              >
                <div className="w-8 h-8 bg-parchment-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Hash className="w-4 h-4 text-ink-400" />
                </div>
                <div>
                  <p className="font-medium text-ink-500 text-sm">Conserver les textes</p>
                  <p className="text-xs text-ink-300 mt-0.5">
                    Les textes sont archivés. Le comptage de mots actuel est conservé, mais vous pourrez le modifier manuellement.
                  </p>
                </div>
              </button>
              <button
                onClick={() => onConfirm(true)}
                className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-parchment-200
                           hover:border-red-300 hover:bg-red-50/30 transition-all text-left"
              >
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <X className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="font-medium text-red-600 text-sm">Supprimer les textes</p>
                  <p className="text-xs text-ink-300 mt-0.5">
                    Tous les textes rédigés dans l'application sont supprimés définitivement. Le comptage de mots est remis à zéro.
                  </p>
                </div>
              </button>
            </div>
            <button onClick={onCancel} className="w-full mt-3 btn-ghost text-sm">Annuler</button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-300 mb-5">
              {isWriteToCount
                ? "Aucun texte rédigé dans l'application — le changement n'entraîne aucune perte de données."
                : "En mode Écriture, vous pourrez rédiger vos scènes directement dans l'application. Le comptage de mots sera calculé automatiquement."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => onConfirm(false)} className="btn-primary flex-1">Confirmer</button>
              <button onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const genre = useBookStore((s) => s.genre);
  const synopsis = useBookStore((s) => s.synopsis);
  const writingMode = useBookStore((s) => s.writingMode);
  const updateProject = useBookStore((s) => s.updateProject);
  const updateWritingMode = useBookStore((s) => s.updateWritingMode);
  const exportProject = useBookStore((s) => s.exportProject);
  const importProject = useBookStore((s) => s.importProject);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState('');
  const [pendingMode, setPendingMode] = useState<WritingMode | null>(null);

  const handleExport = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);

  const buildExportBook = () => ({
    title,
    author,
    genre: genre ?? '',
    synopsis: synopsis ?? '',
    chapters: [...chapters]
      .sort((a, b) => a.number - b.number)
      .map((ch) => ({
        id: ch.id,
        number: ch.number,
        title: ch.title ?? '',
        scenes: ch.sceneIds
          .map((sid) => scenes.find((s) => s.id === sid))
          .filter(Boolean)
          .sort((a, b) => a!.orderInChapter - b!.orderInChapter)
          .map((s, idx) => ({ title: s!.title ?? '', content: s!.content ?? '' })),
      })),
  });

  const handleExportEpub = async () => {
    try {
      await exportEpub(buildExportBook());
    } catch (err) {
      console.error('[Export EPUB]', err);
      alert('Erreur lors de l\'export EPUB. Vérifiez la console.');
    }
  };

  const handleExportPdf = () => {
    exportPdf(buildExportBook());
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProject(reader.result as string);
        setImportStatus('Import reussi !');
        setTimeout(() => setImportStatus(''), 3000);
      } catch {
        setImportStatus('Erreur : fichier invalide');
        setTimeout(() => setImportStatus(''), 3000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="page-container max-w-2xl">
      <h2 className="section-title mb-6">Parametres</h2>

      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">Informations du projet</h3>
        <div className="space-y-4">
          <div>
            <label className="label-field">Titre du livre</label>
            <input value={title} onChange={(e) => updateProject({ title: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Auteur</label>
            <input value={author} onChange={(e) => updateProject({ author: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Genre</label>
            <input value={genre ?? ''} onChange={(e) => updateProject({ genre: e.target.value })} className="input-field" placeholder="Fantasy, Science-Fiction, Thriller..." />
          </div>
          <div>
            <label className="label-field">Synopsis</label>
            <textarea value={synopsis ?? ''} onChange={(e) => updateProject({ synopsis: e.target.value })} className="textarea-field" rows={4} />
          </div>
        </div>
      </div>

      {/* Writing mode */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Mode d'écriture</h3>
        <p className="text-sm text-ink-300 mb-4">
          Vous pouvez changer de mode à tout moment. En cas de passage vers le mode Comptage, vos textes rédigés peuvent être conservés ou supprimés.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Count mode */}
          <button
            type="button"
            onClick={() => { if (writingMode !== 'count') setPendingMode('count'); }}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              writingMode === 'count'
                ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200 cursor-default'
                : 'border-parchment-200 hover:border-parchment-400 cursor-pointer'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              writingMode === 'count' ? 'bg-bordeaux-100' : 'bg-parchment-200'
            }`}>
              <Hash className={`w-5 h-5 ${writingMode === 'count' ? 'text-bordeaux-500' : 'text-ink-300'}`} />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-500 text-sm">Comptage de mots</p>
              <p className="text-xs text-ink-300 mt-1 leading-relaxed">
                Vous écrivez ailleurs et saisissez manuellement le nombre de mots par scène.
              </p>
              {writingMode === 'count' && (
                <span className="inline-block mt-1.5 text-[10px] bg-bordeaux-100 text-bordeaux-600 px-1.5 py-0.5 rounded-full font-medium">
                  Mode actuel
                </span>
              )}
            </div>
          </button>

          {/* Write mode */}
          <button
            type="button"
            onClick={() => { if (writingMode !== 'write') setPendingMode('write'); }}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              writingMode === 'write'
                ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200 cursor-default'
                : 'border-parchment-200 hover:border-parchment-400 cursor-pointer'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              writingMode === 'write' ? 'bg-bordeaux-100' : 'bg-parchment-200'
            }`}>
              <PenLine className={`w-5 h-5 ${writingMode === 'write' ? 'text-bordeaux-500' : 'text-ink-300'}`} />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-500 text-sm">Écriture intégrée</p>
              <p className="text-xs text-ink-300 mt-1 leading-relaxed">
                Vous rédigez directement dans l'application. Le comptage est automatique.
              </p>
              {writingMode === 'write' && (
                <span className="inline-block mt-1.5 text-[10px] bg-bordeaux-100 text-bordeaux-600 px-1.5 py-0.5 rounded-full font-medium">
                  Mode actuel
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Export livre */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Exporter le livre</h3>
        <p className="text-sm text-ink-300 mb-4">
          Téléchargez votre livre dans un format standard, prêt à être lu sur une liseuse ou imprimé.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleExportEpub}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-parchment-200
                       hover:border-bordeaux-300 hover:bg-bordeaux-50/30 transition-all text-left"
          >
            <div className="w-10 h-10 bg-bordeaux-100 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-bordeaux-500" />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-500 text-sm">EPUB</p>
              <p className="text-xs text-ink-300 mt-0.5">Liseuses, Kindle, Apple Books</p>
            </div>
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-parchment-200
                       hover:border-bordeaux-300 hover:bg-bordeaux-50/30 transition-all text-left"
          >
            <div className="w-10 h-10 bg-bordeaux-100 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-bordeaux-500" />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-500 text-sm">PDF</p>
              <p className="text-xs text-ink-300 mt-0.5">Impression, relecture, partage</p>
            </div>
          </button>
        </div>
        {chapters.length === 0 && (
          <p className="text-xs text-ink-200 mt-3 italic">
            Ajoutez des chapitres et des scènes pour pouvoir exporter votre livre.
          </p>
        )}
      </div>

      <div className="card-fantasy p-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">Sauvegarde</h3>
        <p className="text-sm text-ink-300 mb-4">
          Les donnees sont sauvegardees automatiquement dans le navigateur (localStorage).
          Exportez regulierement votre projet en JSON pour avoir une sauvegarde externe.
        </p>
        <div className="flex gap-3">
          <button onClick={handleExport} className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" /> Exporter en JSON
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Importer un JSON
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
        {importStatus && (
          <p className={`text-sm mt-3 ${importStatus.includes('Erreur') ? 'text-red-500' : 'text-green-600'}`}>
            {importStatus}
          </p>
        )}
      </div>

      {/* Writing mode change dialog */}
      {pendingMode && (
        <WritingModeChangeDialog
          fromMode={writingMode}
          toMode={pendingMode}
          onConfirm={(deleteContent) => {
            updateWritingMode(pendingMode, deleteContent);
            setPendingMode(null);
          }}
          onCancel={() => setPendingMode(null)}
        />
      )}
    </div>
  );
}
