import { useRef, useState } from 'react';
import { Download, Upload, Settings } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';

export function SettingsPage() {
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const genre = useBookStore((s) => s.genre);
  const synopsis = useBookStore((s) => s.synopsis);
  const updateProject = useBookStore((s) => s.updateProject);
  const exportProject = useBookStore((s) => s.exportProject);
  const importProject = useBookStore((s) => s.importProject);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState('');

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
    </div>
  );
}
