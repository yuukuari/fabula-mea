import { useRef, useState } from 'react';
import { Download, Upload, Hash, PenLine, AlertTriangle, X, BookOpen, FileText, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { exportEpub } from '@/lib/export-epub';
import { exportPdf } from '@/lib/export-pdf';
import { AVAILABLE_FONTS, AVAILABLE_FONT_SIZES, AVAILABLE_LINE_HEIGHTS, FONT_STACKS, DEFAULT_LAYOUT } from '@/lib/fonts';
import { uploadImage } from '@/lib/upload';
import type { WritingMode, CountUnit, BookFont, BookFontSize, BookLineHeight } from '@/types';

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

/** Modale d'information sur le changement de mise en page */
function LayoutChangeInfoDialog({ onClose }: { onClose: () => void }) {
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

/** Upload d'image de couverture */
function CoverUpload({
  label,
  value,
  onChange,
  aspectHint,
}: {
  label: string;
  value?: string;
  onChange: (img: string | undefined) => void;
  aspectHint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        setIsUploading(true);
        try {
          const url = await uploadImage(reader.result, `cover-${label.toLowerCase().replace(/\s+/g, '-')}`);
          onChange(url);
        } catch {
          onChange(reader.result);
        } finally {
          setIsUploading(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      <label className="label-field">{label}</label>
      {isUploading ? (
        <div className="w-full h-40 border border-parchment-200 rounded-lg bg-white flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-ink-300 animate-spin" />
        </div>
      ) : value ? (
        <div className="relative group">
          <img src={value} alt={label} className="w-full h-40 object-contain border border-parchment-200 rounded-lg bg-white" />
          <button
            onClick={() => onChange(undefined)}
            className="absolute top-1 right-1 p-1 bg-white/90 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-40 border-2 border-dashed border-parchment-300 rounded-lg
                     flex flex-col items-center justify-center gap-2
                     hover:border-bordeaux-300 hover:bg-bordeaux-50/20 transition-all cursor-pointer"
        >
          <ImageIcon className="w-6 h-6 text-ink-200" />
          <span className="text-xs text-ink-300">{aspectHint}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}

export function SettingsPage() {
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const genre = useBookStore((s) => s.genre);
  const synopsis = useBookStore((s) => s.synopsis);
  const writingMode = useBookStore((s) => s.writingMode);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const updateProject = useBookStore((s) => s.updateProject);
  const updateWritingMode = useBookStore((s) => s.updateWritingMode);
  const updateCountUnit = useBookStore((s) => s.updateCountUnit);
  const exportProject = useBookStore((s) => s.exportProject);
  const importProject = useBookStore((s) => s.importProject);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState('');
  const [pendingMode, setPendingMode] = useState<WritingMode | null>(null);
  const [showLayoutInfo, setShowLayoutInfo] = useState(false);

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

  const layout = useBookStore((s) => s.layout);
  const updateLayout = useBookStore((s) => s.updateLayout);
  const tableOfContents = useBookStore((s) => s.tableOfContents ?? false);
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const glossaryEnabled = useBookStore((s) => s.glossaryEnabled);
  const allCharacters = useBookStore((s) => s.characters);
  const allPlaces = useBookStore((s) => s.places);
  const allWorldNotes = useBookStore((s) => s.worldNotes);
  const allMaps = useBookStore((s) => s.maps ?? []);

  const buildExportBook = () => {
    // Build glossary entries from entities marked inGlossary
    const glossary = glossaryEnabled
      ? [
          ...allCharacters.filter((c) => c.inGlossary).map((c) => ({ name: c.name, type: 'character', description: c.description || '' })),
          ...allPlaces.filter((p) => p.inGlossary).map((p) => ({ name: p.name, type: 'place', description: p.description || '' })),
          ...allWorldNotes.filter((w) => w.inGlossary).map((w) => ({ name: w.title, type: 'worldNote', description: w.content || '' })),
        ].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      : [];

    return {
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
          type: ch.type,
          scenes: ch.sceneIds
            .map((sid) => scenes.find((s) => s.id === sid))
            .filter(Boolean)
            .sort((a, b) => a!.orderInChapter - b!.orderInChapter)
            .map((s, idx) => ({ title: s!.title ?? '', content: s!.content ?? '' })),
        })),
      ...(glossary.length > 0 ? { glossary } : {}),
      ...(layout ? { layout } : {}),
      tableOfContents,
      maps: allMaps
        .filter((m) => m.imageUrl)
        .map((m) => ({ id: m.id, name: m.name, imageUrl: m.imageUrl })),
    };
  };

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

      {/* Count unit */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Unité de comptage</h3>
        <p className="text-sm text-ink-300 mb-4">
          Choisissez si les objectifs et jauges sont basés sur les mots ou les signes (espaces compris). L'autre valeur sera affichée à titre informatif.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => updateCountUnit('words')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
              countUnit === 'words'
                ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
            }`}
          >
            Mots
          </button>
          <button
            type="button"
            onClick={() => updateCountUnit('characters')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
              countUnit === 'characters'
                ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
            }`}
          >
            Signes (espaces compris)
          </button>
        </div>
      </div>

      {/* Mise en page */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Mise en page</h3>
        <p className="text-sm text-ink-300 mb-4">
          Ces paramètres s'appliquent à l'éditeur, au mode relecture et aux exports (EPUB/PDF).
        </p>

        <div className="space-y-5">
          {/* Font family */}
          <div>
            <label className="label-field">Police par défaut</label>
            <select
              value={layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily}
              onChange={(e) => { updateLayout({ fontFamily: e.target.value as BookFont }); setShowLayoutInfo(true); }}
              className="input-field"
            >
              {AVAILABLE_FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: FONT_STACKS[f] }}>{f}</option>
              ))}
            </select>
            <p className="text-xs text-ink-200 mt-1">
              Vous pouvez aussi changer la police d'un texte sélectionné dans l'éditeur.
            </p>
          </div>

          {/* Font size + line height side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Taille de police</label>
              <select
                value={layout?.fontSize ?? DEFAULT_LAYOUT.fontSize}
                onChange={(e) => { updateLayout({ fontSize: Number(e.target.value) as BookFontSize }); setShowLayoutInfo(true); }}
                className="input-field"
              >
                {AVAILABLE_FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s} pt</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Interligne</label>
              <select
                value={layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight}
                onChange={(e) => updateLayout({ lineHeight: Number(e.target.value) as BookLineHeight })}
                className="input-field"
              >
                {AVAILABLE_LINE_HEIGHTS.map((lh) => (
                  <option key={lh} value={lh}>{lh === 1.0 ? 'Simple (1.0)' : lh === 1.5 ? 'Standard (1.5)' : lh === 2.0 ? 'Double (2.0)' : lh.toString()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="border border-parchment-200 rounded-lg p-4 bg-white/60">
            <p className="text-xs text-ink-200 mb-2 font-sans">Aperçu</p>
            <p
              className="text-ink-500 text-justify"
              style={{
                fontFamily: FONT_STACKS[layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily],
                fontSize: `${layout?.fontSize ?? DEFAULT_LAYOUT.fontSize}pt`,
                lineHeight: `${layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight}`,
              }}
            >
              « Il est des lieux où souffle l'esprit, des pages où chaque mot porte le poids d'un monde. L'écrivain, tel un artisan patient, tisse ses phrases avec le soin d'un orfèvre — car chaque virgule, chaque silence, chaque élan du récit est une promesse faite au lecteur. »
            </p>
          </div>
        </div>
      </div>

      {/* Couvertures */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Couvertures</h3>
        <p className="text-sm text-ink-300 mb-4">
          Images utilisées pour les exports et la présentation du livre.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Front cover */}
          <CoverUpload
            label="1ère de couverture"
            value={layout?.coverFront}
            onChange={(img) => updateLayout({ coverFront: img })}
            aspectHint="Format portrait recommandé"
          />
          {/* Back cover */}
          <CoverUpload
            label="4ème de couverture"
            value={layout?.coverBack}
            onChange={(img) => updateLayout({ coverBack: img })}
            aspectHint="Format portrait recommandé"
          />
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

      {/* Layout info dialog */}
      {showLayoutInfo && <LayoutChangeInfoDialog onClose={() => setShowLayoutInfo(false)} />}

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
