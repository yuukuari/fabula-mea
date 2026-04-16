import { RotateCcw } from 'lucide-react';
import type { PrintEdition, PrintMargins, PaperType } from '@/types';
import { PAPER_TYPES, DEFAULT_MARGINS, getTrimSize } from '@/lib/print-edition';

interface Props {
  draft: PrintEdition;
  onChange: (data: Partial<PrintEdition>) => void;
}

export function StepInterior({ draft, onChange }: Props) {
  const trim = getTrimSize(draft.trimSize);

  const handleMarginChange = (key: keyof PrintMargins, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    onChange({ margins: { ...draft.margins, [key]: num } });
  };

  const handleResetMargins = () => {
    onChange({ margins: DEFAULT_MARGINS[draft.trimSize] });
  };

  const handlePaperChange = (id: PaperType) => {
    onChange({ paperType: id });
  };

  // Mini page preview proportions
  const previewW = 100;
  const previewH = (trim.heightMm / trim.widthMm) * previewW;
  const m = draft.margins;
  const topPct = (m.topMm / trim.heightMm) * 100;
  const bottomPct = (m.bottomMm / trim.heightMm) * 100;
  const innerPct = (m.innerMm / trim.widthMm) * 100;
  const outerPct = (m.outerMm / trim.widthMm) * 100;

  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Intérieur</h3>
      <p className="text-sm text-ink-300 mb-4">
        Choisissez le type de papier et ajustez les marges.
      </p>

      {/* Paper type */}
      <label className="label-field mb-2">Type de papier</label>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {PAPER_TYPES.map((p) => {
          const selected = draft.paperType === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handlePaperChange(p.id)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                selected
                  ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200'
                  : 'border-parchment-200 hover:border-bordeaux-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-5 h-5 rounded-full border border-parchment-300 shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-sm font-medium text-ink-500">{p.label}</span>
              </div>
              <p className="text-[10px] text-ink-200">{p.thicknessMm} mm / feuille</p>
            </button>
          );
        })}
      </div>

      {/* Margins */}
      <div className="flex items-center justify-between mb-2">
        <label className="label-field">Marges (mm)</label>
        <button
          onClick={handleResetMargins}
          className="text-xs text-bordeaux-400 hover:text-bordeaux-600 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Réinitialiser
        </button>
      </div>

      <div className="flex gap-6 items-start">
        <div className="grid grid-cols-2 gap-3 flex-1">
          {([
            ['topMm', 'Haut'] as const,
            ['bottomMm', 'Bas'] as const,
            ['innerMm', 'Intérieur (reliure)'] as const,
            ['outerMm', 'Extérieur'] as const,
          ]).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-ink-300 block mb-0.5">{label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={draft.margins[key]}
                  onChange={(e) => handleMarginChange(key, e.target.value)}
                  className="input-field w-full text-sm"
                />
                <span className="text-xs text-ink-200 shrink-0">mm</span>
              </div>
            </div>
          ))}
        </div>

        {/* Mini preview */}
        <div className="shrink-0 flex flex-col items-center">
          <div
            className="border border-parchment-300 bg-white relative"
            style={{ width: previewW, height: previewH }}
          >
            <div
              className="absolute bg-parchment-100 border border-dashed border-parchment-300"
              style={{
                top: `${topPct}%`,
                bottom: `${bottomPct}%`,
                left: `${innerPct}%`,
                right: `${outerPct}%`,
              }}
            >
              {/* Content area lines */}
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[2px] bg-parchment-200 mx-1 mt-1.5" />
              ))}
            </div>
          </div>
          <p className="text-[9px] text-ink-200 mt-1">Aperçu</p>
        </div>
      </div>
    </div>
  );
}
