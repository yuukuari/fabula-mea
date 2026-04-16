import type { PrintEdition, TrimSizeId } from '@/types';
import { useBookStore } from '@/store/useBookStore';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import { TRIM_SIZES, DEFAULT_MARGINS, estimatePageCount } from '@/lib/print-edition';
import { countFromHtml } from '@/lib/utils';

interface Props {
  draft: PrintEdition;
  onChange: (data: Partial<PrintEdition>) => void;
}

export function StepTrimSize({ draft, onChange }: Props) {
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const layout = useBookStore((s) => s.layout);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');

  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;

  const totalWords = scenes.reduce((sum, s) => {
    const count = countUnit === 'words'
      ? (s.currentWordCount ?? countFromHtml(s.content ?? '', 'words'))
      : countFromHtml(s.content ?? '', 'characters');
    return sum + count;
  }, 0);
  const chapterCount = chapters.filter((c) => c.type === 'chapter').length;

  const handleSelect = (id: TrimSizeId) => {
    onChange({
      trimSize: id,
      margins: DEFAULT_MARGINS[id],
    });
  };

  const pageCount = estimatePageCount(totalWords, draft.trimSize, fontSize, lineHeight, draft.margins, chapterCount);

  // Reference dimensions for proportional rendering
  const maxH = 234; // royal height

  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Format du livre</h3>
      <p className="text-sm text-ink-300 mb-4">
        Choisissez le format d'impression de votre livre.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {TRIM_SIZES.map((t) => {
          const selected = draft.trimSize === t.id;
          const scaleH = (t.heightMm / maxH) * 80;
          const scaleW = (t.widthMm / maxH) * 80;

          return (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selected
                  ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200'
                  : 'border-parchment-200 hover:border-bordeaux-200 hover:bg-parchment-50'
              }`}
            >
              {/* Proportional book rectangle */}
              <div className="flex justify-center mb-3">
                <div
                  className={`rounded-sm border ${selected ? 'border-bordeaux-300 bg-bordeaux-50' : 'border-parchment-300 bg-parchment-50'}`}
                  style={{ width: scaleW, height: scaleH }}
                />
              </div>
              <p className="font-display font-semibold text-sm text-ink-500">{t.label}</p>
              <p className="text-xs text-ink-300">{t.widthMm} × {t.heightMm} mm</p>
              <p className="text-[10px] text-ink-200 mt-0.5">{t.description}</p>
            </button>
          );
        })}
      </div>

      {totalWords > 0 && (
        <p className="text-sm text-ink-400 text-center py-2 bg-parchment-50 rounded-lg border border-parchment-200">
          Votre livre fera environ <strong className="text-bordeaux-500">{pageCount} pages</strong> dans ce format.
        </p>
      )}
    </div>
  );
}
