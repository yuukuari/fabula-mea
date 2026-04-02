import { useRef, useState } from 'react';
import { BookOpen, FileText, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { exportEpub } from '@/lib/export-epub';
import { exportPdf } from '@/lib/export-pdf';
import { uploadImage } from '@/lib/upload';

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

export function EditionPage() {
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const genre = useBookStore((s) => s.genre);
  const synopsis = useBookStore((s) => s.synopsis);
  const layout = useBookStore((s) => s.layout);
  const updateLayout = useBookStore((s) => s.updateLayout);
  const tableOfContents = useBookStore((s) => s.tableOfContents ?? false);
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const glossaryEnabled = useBookStore((s) => s.glossaryEnabled);
  const { characters: allCharacters, places: allPlaces, worldNotes: allWorldNotes, maps: allMaps } = useEncyclopediaStore();

  const buildExportBook = () => {
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
            .map((s) => ({ title: s!.title ?? '', content: s!.content ?? '' })),
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

  return (
    <div className="page-container max-w-2xl">
      <h2 className="section-title mb-6">Édition</h2>

      {/* Couvertures */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Couvertures</h3>
        <p className="text-sm text-ink-300 mb-4">
          Images utilisées pour les exports et la présentation du livre.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CoverUpload
            label="1ère de couverture"
            value={layout?.coverFront}
            onChange={(img) => updateLayout({ coverFront: img })}
            aspectHint="Format portrait recommandé"
          />
          <CoverUpload
            label="4ème de couverture"
            value={layout?.coverBack}
            onChange={(img) => updateLayout({ coverBack: img })}
            aspectHint="Format portrait recommandé"
          />
        </div>
      </div>

      {/* Export livre */}
      <div className="card-fantasy p-6">
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
    </div>
  );
}
