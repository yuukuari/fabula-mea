import { useRef, useState } from 'react';
import { Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { uploadImage } from '@/lib/upload';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import {
  getTrimSize, calculateSpineWidth, calculateCoverDimensions, estimatePageCount,
} from '@/lib/print-edition';
import { countFromHtml } from '@/lib/utils';

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
  const printEdition = layout?.printEdition;
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');

  // Calculate cover dimensions if print edition is configured
  let coverDims: ReturnType<typeof calculateCoverDimensions> | null = null;
  if (printEdition) {
    const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
    const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
    const totalWords = scenes.reduce((sum, s) => {
      const count = countUnit === 'words'
        ? (s.currentWordCount ?? countFromHtml(s.content ?? '', 'words'))
        : countFromHtml(s.content ?? '', 'characters');
      return sum + count;
    }, 0);
    const chapterCount = chapters.filter((c) => c.type === 'chapter').length;
    const pageCount = estimatePageCount(totalWords, printEdition.trimSize, fontSize, lineHeight, printEdition.margins, chapterCount);
    coverDims = calculateCoverDimensions(printEdition.trimSize, pageCount, printEdition.paperType, printEdition.bleedMm);
  }

  const trim = printEdition ? getTrimSize(printEdition.trimSize) : null;

  return (
    <div className="card-fantasy p-6 mb-6">
      <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Couvertures</h3>
      <p className="text-sm text-ink-300 mb-4">
        Images utilisées pour les exports et la présentation du livre.
      </p>

      {coverDims && trim && (
        <>
          {/* Dimensions summary */}
          <div className="text-xs text-ink-300 mb-3 p-2 bg-parchment-50 rounded-lg border border-parchment-200">
            <p className="font-medium text-ink-400 mb-1">
              Couverture complète : {coverDims.totalWidthMm} × {coverDims.totalHeightMm} mm
            </p>
            <p>Dos : {coverDims.spineWidthMm} mm · Fond perdu : {coverDims.bleedMm} mm de chaque côté</p>
          </div>

          {/* SVG cover diagram */}
          <CoverDiagram dims={coverDims} />
        </>
      )}

      <div className={`grid gap-4 ${printEdition ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <CoverUpload
          label="1ère de couverture"
          value={layout?.coverFront}
          onChange={(img) => updateLayout({ coverFront: img })}
          recommendedDimensions={trim ? `${trim.widthMm} × ${trim.heightMm} mm` : undefined}
        />
        {printEdition && (
          <CoverUpload
            label="Dos"
            value={layout?.coverSpine}
            onChange={(img) => updateLayout({ coverSpine: img })}
            recommendedDimensions={coverDims ? `${coverDims.spineWidthMm} × ${trim!.heightMm} mm` : undefined}
          />
        )}
        <CoverUpload
          label="4ème de couverture"
          value={layout?.coverBack}
          onChange={(img) => updateLayout({ coverBack: img })}
          recommendedDimensions={trim ? `${trim.widthMm} × ${trim.heightMm} mm` : undefined}
        />
      </div>
    </div>
  );
}

function CoverDiagram({ dims }: { dims: ReturnType<typeof calculateCoverDimensions> }) {
  const totalW = dims.totalWidthMm;
  const totalH = dims.totalHeightMm;

  // Scale to fit in a container (max width ~500px)
  const svgWidth = 500;
  const scale = svgWidth / totalW;
  const svgHeight = totalH * scale;

  const bleed = dims.bleedMm * scale;
  const backW = dims.backWidthMm * scale;
  const spineW = Math.max(dims.spineWidthMm * scale, 4); // min 4px for visibility
  const frontW = dims.frontWidthMm * scale;

  const y = 0;
  let x = 0;

  return (
    <div className="mb-4 overflow-x-auto">
      <svg width={svgWidth} height={svgHeight + 40} className="mx-auto block" viewBox={`0 0 ${svgWidth} ${svgHeight + 40}`}>
        {/* Bleed left */}
        <rect x={x} y={y} width={bleed} height={svgHeight} fill="#fce4ec" stroke="#e57373" strokeWidth={0.5} />
        <text x={x + bleed / 2} y={svgHeight + 12} textAnchor="middle" fontSize={8} fill="#999">{dims.bleedMm}</text>
        {x += bleed}

        {/* Back cover */}
        <rect x={x} y={y} width={backW} height={svgHeight} fill="#e3f2fd" stroke="#90caf9" strokeWidth={0.5} />
        <text x={x + backW / 2} y={svgHeight / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#666">4ème</text>
        <text x={x + backW / 2} y={svgHeight + 12} textAnchor="middle" fontSize={8} fill="#999">{dims.backWidthMm}</text>
        {x += backW}

        {/* Spine */}
        <rect x={x} y={y} width={spineW} height={svgHeight} fill="#fff3e0" stroke="#ffb74d" strokeWidth={0.5} />
        <text x={x + spineW / 2} y={svgHeight + 12} textAnchor="middle" fontSize={7} fill="#999">{dims.spineWidthMm}</text>
        {x += spineW}

        {/* Front cover */}
        <rect x={x} y={y} width={frontW} height={svgHeight} fill="#e8f5e9" stroke="#81c784" strokeWidth={0.5} />
        <text x={x + frontW / 2} y={svgHeight / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#666">1ère</text>
        <text x={x + frontW / 2} y={svgHeight + 12} textAnchor="middle" fontSize={8} fill="#999">{dims.frontWidthMm}</text>
        {x += frontW}

        {/* Bleed right */}
        <rect x={x} y={y} width={bleed} height={svgHeight} fill="#fce4ec" stroke="#e57373" strokeWidth={0.5} />
        <text x={x + bleed / 2} y={svgHeight + 12} textAnchor="middle" fontSize={8} fill="#999">{dims.bleedMm}</text>

        {/* Total width annotation */}
        <line x1={0} y1={svgHeight + 25} x2={svgWidth} y2={svgHeight + 25} stroke="#bbb" strokeWidth={0.5} />
        <text x={svgWidth / 2} y={svgHeight + 36} textAnchor="middle" fontSize={9} fill="#888">{dims.totalWidthMm} mm</text>

        {/* Height annotation */}
        <text x={svgWidth + 2} y={svgHeight / 2} textAnchor="start" dominantBaseline="middle" fontSize={8} fill="#888" transform={`rotate(90, ${svgWidth + 2}, ${svgHeight / 2})`}>{dims.totalHeightMm} mm</text>
      </svg>
    </div>
  );
}
