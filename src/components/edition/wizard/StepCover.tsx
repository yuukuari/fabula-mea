import { Info } from 'lucide-react';
import type { PrintEdition } from '@/types';
import { useBookStore } from '@/store/useBookStore';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import {
  getTrimSize, estimatePageCount, calculateCoverDimensions,
} from '@/lib/print-edition';
import { countFromHtml } from '@/lib/utils';

interface Props {
  draft: PrintEdition;
  onChange: (data: Partial<PrintEdition>) => void;
}

export function StepCover({ draft, onChange }: Props) {
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const layout = useBookStore((s) => s.layout);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');

  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const trim = getTrimSize(draft.trimSize);

  const totalWords = scenes.reduce((sum, s) => {
    const count = countUnit === 'words'
      ? (s.currentWordCount ?? countFromHtml(s.content ?? '', 'words'))
      : countFromHtml(s.content ?? '', 'characters');
    return sum + count;
  }, 0);
  const chapterCount = chapters.filter((c) => c.type === 'chapter').length;
  const pageCount = estimatePageCount(totalWords, draft.trimSize, fontSize, lineHeight, draft.margins, chapterCount);
  const dims = calculateCoverDimensions(draft.trimSize, pageCount, draft.paperType, draft.bleedMm);

  // SVG proportional diagram
  const svgWidth = 460;
  const scale = svgWidth / dims.totalWidthMm;
  const svgHeight = dims.totalHeightMm * scale;
  const bleed = dims.bleedMm * scale;
  const backW = dims.backWidthMm * scale;
  const spineW = Math.max(dims.spineWidthMm * scale, 6);
  const frontW = dims.frontWidthMm * scale;

  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Couverture</h3>
      <p className="text-sm text-ink-300 mb-4">
        Dimensions calculées pour votre couverture à plat.
      </p>

      {/* Bleed input */}
      <div className="mb-4">
        <label className="label-field mb-1">Fond perdu</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={draft.bleedMm}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0) onChange({ bleedMm: v });
            }}
            className="input-field w-24 text-sm"
          />
          <span className="text-xs text-ink-300">mm de chaque côté</span>
        </div>
      </div>

      {/* Diagram */}
      <div className="mb-4 overflow-x-auto">
        <svg width={svgWidth} height={svgHeight + 50} className="mx-auto block" viewBox={`0 0 ${svgWidth} ${svgHeight + 50}`}>
          {(() => {
            let x = 0;
            return (
              <>
                {/* Bleed left */}
                <rect x={x} y={0} width={bleed} height={svgHeight} fill="#fce4ec" stroke="#e57373" strokeWidth={0.5} strokeDasharray="2,2" />
                {(() => { const cx = x; x += bleed; return <text key="bl" x={cx + bleed / 2} y={svgHeight + 12} textAnchor="middle" fontSize={8} fill="#e57373">{dims.bleedMm}</text>; })()}

                {/* Back */}
                <rect x={x} y={0} width={backW} height={svgHeight} fill="#f5f5f5" stroke="#bbb" strokeWidth={0.5} />
                <text x={x + backW / 2} y={svgHeight / 2 - 6} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#666">4ème de couverture</text>
                <text x={x + backW / 2} y={svgHeight / 2 + 10} textAnchor="middle" fontSize={9} fill="#999">{trim.widthMm} × {trim.heightMm} mm</text>
                {(() => { const cx = x; x += backW; return <text key="bk" x={cx + backW / 2} y={svgHeight + 12} textAnchor="middle" fontSize={8} fill="#999">{dims.backWidthMm}</text>; })()}

                {/* Spine */}
                <rect x={x} y={0} width={spineW} height={svgHeight} fill="#fff3e0" stroke="#ffb74d" strokeWidth={0.5} />
                <text x={x + spineW / 2} y={svgHeight / 2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#e65100" transform={`rotate(-90, ${x + spineW / 2}, ${svgHeight / 2})`}>Dos</text>
                {(() => { const cx = x; x += spineW; return <text key="sp" x={cx + spineW / 2} y={svgHeight + 12} textAnchor="middle" fontSize={7} fill="#e65100">{dims.spineWidthMm}</text>; })()}

                {/* Front */}
                <rect x={x} y={0} width={frontW} height={svgHeight} fill="#f5f5f5" stroke="#bbb" strokeWidth={0.5} />
                <text x={x + frontW / 2} y={svgHeight / 2 - 6} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#666">1ère de couverture</text>
                <text x={x + frontW / 2} y={svgHeight / 2 + 10} textAnchor="middle" fontSize={9} fill="#999">{trim.widthMm} × {trim.heightMm} mm</text>
                {(() => { const cx = x; x += frontW; return <text key="fr" x={cx + frontW / 2} y={svgHeight + 12} textAnchor="middle" fontSize={8} fill="#999">{dims.frontWidthMm}</text>; })()}

                {/* Bleed right */}
                <rect x={x} y={0} width={bleed} height={svgHeight} fill="#fce4ec" stroke="#e57373" strokeWidth={0.5} strokeDasharray="2,2" />
                <text x={x + bleed / 2} y={svgHeight + 12} textAnchor="middle" fontSize={8} fill="#e57373">{dims.bleedMm}</text>

                {/* Total annotation */}
                <line x1={0} y1={svgHeight + 28} x2={svgWidth} y2={svgHeight + 28} stroke="#bbb" strokeWidth={0.5} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                <text x={svgWidth / 2} y={svgHeight + 42} textAnchor="middle" fontSize={10} fill="#666" fontWeight="bold">{dims.totalWidthMm} × {dims.totalHeightMm} mm</text>
              </>
            );
          })()}
        </svg>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 bg-parchment-50 rounded-lg border border-parchment-200 text-xs text-ink-300">
        <Info className="w-4 h-4 text-ink-200 shrink-0 mt-0.5" />
        <p>
          Les images de couverture se téléchargent dans la section « Couvertures » de la page Édition.
          Utilisez ces dimensions pour créer vos fichiers dans votre logiciel de graphisme.
        </p>
      </div>
    </div>
  );
}
