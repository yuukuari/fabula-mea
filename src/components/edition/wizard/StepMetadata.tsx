import type { PrintEdition } from '@/types';

interface Props {
  draft: PrintEdition;
  onChange: (data: Partial<PrintEdition>) => void;
}

export function StepMetadata({ draft, onChange }: Props) {
  const handleIsbnChange = (value: string) => {
    // Strip everything except digits and hyphens for display
    onChange({ isbn: value });
  };

  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Métadonnées</h3>
      <p className="text-sm text-ink-300 mb-4">
        Informations optionnelles pour l'édition et la distribution.
      </p>

      <div className="space-y-4">
        {/* ISBN */}
        <div>
          <label className="label-field">ISBN</label>
          <input
            type="text"
            value={draft.isbn ?? ''}
            onChange={(e) => handleIsbnChange(e.target.value)}
            placeholder="978-2-XXXX-XXXX-X"
            className="input-field w-full"
          />
          <p className="text-[10px] text-ink-200 mt-1">
            Numéro international normalisé du livre (10 ou 13 chiffres). Optionnel.
          </p>
        </div>

        {/* Publisher */}
        <div>
          <label className="label-field">Éditeur</label>
          <input
            type="text"
            value={draft.publisher ?? ''}
            onChange={(e) => onChange({ publisher: e.target.value || undefined })}
            placeholder="Nom de l'éditeur ou autoédition"
            className="input-field w-full"
          />
        </div>

        {/* Print date */}
        <div>
          <label className="label-field">Date de publication prévue</label>
          <input
            type="month"
            value={draft.printDate ?? ''}
            onChange={(e) => onChange({ printDate: e.target.value || undefined })}
            className="input-field w-full"
          />
        </div>
      </div>
    </div>
  );
}
