import { useRef, useState } from 'react';
import { Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { uploadImage } from '@/lib/upload';
import { DEFAULT_LAYOUT, AVAILABLE_FONTS, FONT_STACKS } from '@/lib/fonts';
import {
  getTrimSize, calculateSpineWidth, calculateCoverDimensions, estimatePageCount,
  type CoverDimensions,
} from '@/lib/print-edition';
import { isSpecialChapter, totalScenesCount } from '@/lib/utils';
import type { BookFont, CoverMode, CoverSimplifiedConfig } from '@/types';
import { getCoverMode, getSimplifiedCover, SPINE_MIN_TEXT_MM } from '@/lib/cover-composition';
import { SpineWidthTooltip } from './SpineWidthLabel';
import { CoverFlatPreview } from './CoverFlatPreview';
import { CoverAdvancedEditor } from './CoverAdvancedEditor';

function CoverUpload({
  label,
  value,
  onChange,
  recommendedDimensions,
}: {
  label: string;
  value?: string;
  onChange: (img: string | undefined) => void;
  recommendedDimensions?: string;
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
      {recommendedDimensions && (
        <p className="text-[10px] text-ink-200 mb-1">{recommendedDimensions}</p>
      )}
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
          <span className="text-xs text-ink-300">Cliquez pour ajouter</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}

export function CoverSection() {
  const layout = useBookStore((s) => s.layout);
  const updateLayout = useBookStore((s) => s.updateLayout);
  const updateCoverSimplified = useBookStore((s) => s.updateCoverSimplified);
  const updateCoverAdvanced = useBookStore((s) => s.updateCoverAdvanced);
  const printEdition = layout?.printEdition;
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);

  const mode = getCoverMode(layout);
  const simplified = getSimplifiedCover(layout);

  // Calculate cover dimensions if print edition is configured
  let coverDims: CoverDimensions | null = null;
  if (printEdition) {
    const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
    const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
    const totalWords = totalScenesCount(scenes, countUnit);
    const chapterCount = chapters.filter((c) => !isSpecialChapter(c)).length;
    const pageCount = estimatePageCount(totalWords, printEdition.trimSize, fontSize, lineHeight, printEdition.margins, chapterCount);
    coverDims = calculateCoverDimensions(printEdition.trimSize, pageCount, printEdition.paperType, printEdition.bleedMm);
  }

  const trim = printEdition ? getTrimSize(printEdition.trimSize) : null;
  const spineWidth = printEdition && coverDims ? coverDims.spineWidthMm : 0;
  const isSpineThin = spineWidth < SPINE_MIN_TEXT_MM;

  const setMode = (next: CoverMode) => {
    updateLayout({ coverMode: next });
  };

  return (
    <div className="card-fantasy p-6 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-500">Couvertures</h3>
          <p className="text-sm text-ink-300 mt-0.5">
            {mode === 'simplified'
              ? 'Téléversez la 1ère et la 4ème de couverture. Le dos est composé automatiquement.'
              : 'Mode avancé — téléversez une couverture dépliée et positionnez les textes.'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-parchment-100 shrink-0">
          <ModeButton active={mode === 'simplified'} onClick={() => setMode('simplified')} label="Simplifié" />
          <ModeButton active={mode === 'advanced'} onClick={() => setMode('advanced')} label="Avancé" />
        </div>
      </div>

      {/* Dimensions info */}
      {coverDims && trim && (
        <div className="text-xs text-ink-300 mb-4 p-2.5 bg-parchment-50 rounded-lg border border-parchment-200">
          <p className="font-medium text-ink-400 mb-0.5 inline-flex items-center gap-1">
            Couverture dépliée : <b>{coverDims.totalWidthMm} × {coverDims.totalHeightMm} mm</b>
          </p>
          <p className="inline-flex items-center gap-1">
            Dos : <b>~{coverDims.spineWidthMm} mm</b>
            <SpineWidthTooltip />
            {' '}· Fond perdu : {coverDims.bleedMm} mm de chaque côté
          </p>
        </div>
      )}

      {!printEdition && (
        <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 text-xs text-ink-400 mb-4">
          L'édition papier n'est pas configurée. Les dimensions et l'aperçu déplié ne seront disponibles qu'après configuration du format.
        </div>
      )}

      {/* ─── Simplified mode ─── */}
      {mode === 'simplified' && (
        <div className="space-y-4">
          <div className={`grid gap-4 ${printEdition ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
            <CoverUpload
              label="1ère de couverture"
              value={layout?.coverFront}
              onChange={(img) => updateLayout({ coverFront: img })}
              recommendedDimensions={trim ? `${trim.widthMm} × ${trim.heightMm} mm` : undefined}
            />
            <CoverUpload
              label="4ème de couverture"
              value={layout?.coverBack}
              onChange={(img) => updateLayout({ coverBack: img })}
              recommendedDimensions={trim ? `${trim.widthMm} × ${trim.heightMm} mm` : undefined}
            />
          </div>

          {/* Spine configuration (only meaningful if printEdition configured) */}
          {printEdition && (
            <SpineConfig
              simplified={simplified}
              onChange={(data) => updateCoverSimplified(data)}
              spineWidth={spineWidth}
              isSpineThin={isSpineThin}
              bookFont={layout?.fontFamily ?? 'Times New Roman'}
            />
          )}

          {/* Flat preview */}
          {coverDims && (
            <div>
              <p className="text-xs text-ink-300 mb-1.5">Aperçu couverture dépliée</p>
              <CoverFlatPreview
                layout={layout}
                dims={coverDims}
                title={title}
                author={author}
                widthPx={500}
              />
            </div>
          )}
        </div>
      )}

      {/* ─── Advanced mode ─── */}
      {mode === 'advanced' && coverDims && (
        <CoverAdvancedEditor
          layout={layout}
          title={title}
          author={author}
          dims={coverDims}
          onUpdateAdvanced={(data) => updateCoverAdvanced(data)}
        />
      )}

      {mode === 'advanced' && !coverDims && (
        <div className="p-6 rounded-lg bg-parchment-100 text-center text-sm text-ink-400">
          Le mode avancé nécessite de configurer l'édition papier d'abord (format, papier, marges).
        </div>
      )}
    </div>
  );
}

// ─── Spine configuration (simplified mode) ───

function SpineConfig({
  simplified, onChange, spineWidth, isSpineThin, bookFont,
}: {
  simplified: CoverSimplifiedConfig;
  onChange: (data: Partial<CoverSimplifiedConfig>) => void;
  spineWidth: number;
  isSpineThin: boolean;
  bookFont: BookFont;
}) {
  const spineFontFamily = simplified.spineFontFamily ?? bookFont;

  return (
    <div className="p-4 rounded-lg bg-parchment-50 border border-parchment-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display font-semibold text-ink-500 text-sm">Dos du livre</h4>
        {isSpineThin && (
          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            Dos ~{spineWidth} mm — trop fin pour du texte
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Spine color */}
        <div>
          <label className="text-[11px] font-medium text-ink-300 uppercase tracking-wide">Couleur du dos</label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              value={simplified.spineColor ?? '#7a1b3a'}
              onChange={(e) => onChange({ spineColor: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer border border-parchment-300"
            />
            <input
              type="text"
              value={simplified.spineColor ?? '#7a1b3a'}
              onChange={(e) => onChange({ spineColor: e.target.value })}
              className="input-field text-sm flex-1 font-mono"
              placeholder="#7a1b3a"
            />
          </div>
        </div>

        {/* Show title toggle */}
        <div>
          <label className="text-[11px] font-medium text-ink-300 uppercase tracking-wide">Titre + auteur</label>
          <div className="mt-1">
            <label className="flex items-center gap-2 text-sm text-ink-400 cursor-pointer">
              <input
                type="checkbox"
                checked={simplified.spineShowTitle ?? true}
                onChange={(e) => onChange({ spineShowTitle: e.target.checked })}
                disabled={isSpineThin}
                className="accent-bordeaux-500"
              />
              <span>Afficher verticalement sur le dos</span>
            </label>
            {isSpineThin && (
              <p className="text-[10px] text-ink-200 mt-1">Désactivé car le dos est trop fin.</p>
            )}
          </div>
        </div>

        {(simplified.spineShowTitle ?? true) && !isSpineThin && (
          <>
            <div>
              <label className="text-[11px] font-medium text-ink-300 uppercase tracking-wide">Police</label>
              <select
                value={spineFontFamily}
                onChange={(e) => onChange({ spineFontFamily: e.target.value as BookFont })}
                className="input-field text-sm mt-1"
                style={{ fontFamily: FONT_STACKS[spineFontFamily] }}
              >
                {AVAILABLE_FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: FONT_STACKS[f] }}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-ink-300 uppercase tracking-wide">Couleur du texte</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={simplified.spineTextColor ?? '#fafafa'}
                  onChange={(e) => onChange({ spineTextColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-parchment-300"
                />
                <input
                  type="text"
                  value={simplified.spineTextColor ?? '#fafafa'}
                  onChange={(e) => onChange({ spineTextColor: e.target.value })}
                  className="input-field text-sm flex-1 font-mono"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-medium text-ink-300 uppercase tracking-wide">Orientation du texte</label>
              <div className="flex items-center gap-2 mt-1">
                <OrientationButton
                  active={simplified.spineOrientation !== 'btt'}
                  onClick={() => onChange({ spineOrientation: 'ttb' })}
                  label="Haut → bas (standard américain / KDP)"
                />
                <OrientationButton
                  active={simplified.spineOrientation === 'btt'}
                  onClick={() => onChange({ spineOrientation: 'btt' })}
                  label="Bas → haut (standard européen)"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
        active ? 'bg-white text-bordeaux-500 shadow-sm' : 'text-ink-300 hover:text-ink-500'
      }`}
    >
      {label}
    </button>
  );
}

function OrientationButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-xs font-medium rounded border-2 transition-all ${
        active ? 'border-bordeaux-400 bg-bordeaux-50/40 text-bordeaux-600' : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
      }`}
    >
      {label}
    </button>
  );
}
