/**
 * Displays a spine width value with a hover tooltip explaining the ±10% tolerance.
 * Also adds an ⚠ indicator when the spine is too thin for vertical text.
 */
import { Info } from 'lucide-react';

interface Props {
  /** Spine width in mm (from calculateSpineWidth). */
  mm: number;
  /** Render mode — how tightly integrated with surrounding text. */
  variant?: 'inline' | 'block';
  /** Show the tooltip icon. Default: true. */
  withTooltip?: boolean;
}

const THIN_THRESHOLD_MM = 6;

export function SpineWidthLabel({ mm, variant = 'inline', withTooltip = true }: Props) {
  const tooLight = mm < THIN_THRESHOLD_MM;

  const content = (
    <>
      <span>~{mm} mm</span>
      {tooLight && (
        <span className="text-[10px] text-amber-600 ml-1" title="Dos trop fin pour du texte vertical lisible">
          (dos très fin)
        </span>
      )}
    </>
  );

  if (!withTooltip) {
    return variant === 'block' ? <div>{content}</div> : <span>{content}</span>;
  }

  const Tag = variant === 'block' ? 'div' : 'span';
  return (
    <Tag className="inline-flex items-center gap-1">
      {content}
      <span className="relative group/tip inline-flex items-center">
        <Info className="w-3 h-3 text-ink-200 cursor-help" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] text-white bg-ink-500 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">
          Estimation ±10 % — l'imprimeur calcule le dos définitif
        </span>
      </span>
    </Tag>
  );
}

/** Just the tooltip without the value, for inline use next to a value. */
export function SpineWidthTooltip() {
  return (
    <span className="relative group/tip inline-flex items-center">
      <Info className="w-3 h-3 text-ink-200 cursor-help" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] text-white bg-ink-500 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">
        Estimation ±10 % — l'imprimeur calcule le dos définitif
      </span>
    </span>
  );
}
