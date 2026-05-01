import { BookText } from 'lucide-react';

interface Props {
  inGlossary: boolean;
  onToggle: (next: boolean) => void;
}

/**
 * Small clickable badge showing whether an entity is in the glossary.
 * Click toggles the state directly — no modal needed.
 *
 * Used on character / place / world-note detail pages.
 */
export function GlossaryBadge({ inGlossary, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!inGlossary)}
      className={
        inGlossary
          ? 'flex items-center gap-1 text-xs text-bordeaux-500 hover:text-bordeaux-700 transition-colors cursor-pointer'
          : 'flex items-center gap-1 text-xs text-ink-200 hover:text-bordeaux-500 transition-colors cursor-pointer'
      }
      title={inGlossary ? 'Retirer du glossaire' : 'Ajouter au glossaire'}
    >
      <BookText className="w-3.5 h-3.5" />
      {inGlossary ? 'Glossaire' : 'Ajouter au glossaire'}
    </button>
  );
}
