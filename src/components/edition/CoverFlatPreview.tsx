/**
 * SVG preview of the flat cover (back | spine | front), used in both the
 * simplified and advanced cover modes.
 *
 * Simplified mode renders: back image, spine color + optional rotated title,
 * front image.
 * Advanced mode renders: flat image background + overlay text elements.
 */
import type { BookLayout, CoverTextOverlay } from '@/types';
import type { CoverDimensions } from '@/lib/print-edition';
import { getCoverMode, getAdvancedCover, resolveSpineRender, resolveCoverColor } from '@/lib/cover-composition';

interface Props {
  layout: BookLayout | undefined;
  dims: CoverDimensions;
  title: string;
  author: string;
  /** CSS pixel width the preview should occupy. Height derived from dims. */
  widthPx?: number;
  /** Show crop/trim/safety guides on top. */
  showGuides?: boolean;
  /** Called when a specific overlay is clicked (advanced mode only). */
  onSelectOverlay?: (id: string | null) => void;
  selectedOverlayId?: string | null;
}

export function CoverFlatPreview({
  layout, dims, title, author, widthPx = 500, showGuides = false,
  onSelectOverlay, selectedOverlayId,
}: Props) {
  const mode = getCoverMode(layout);
  const { totalWidthMm, totalHeightMm, bleedMm, backWidthMm, spineWidthMm, frontWidthMm } = dims;
  const scale = widthPx / totalWidthMm;
  const svgHeight = totalHeightMm * scale;

  // Region positions (in mm, origin at top-left of the flat cover)
  const backX = bleedMm;
  const spineX = backX + backWidthMm;
  const frontX = spineX + spineWidthMm;
  const trimTop = bleedMm;
  const trimBottom = totalHeightMm - bleedMm;

  // mm → px
  const m2p = (mm: number) => mm * scale;

  const spineRender = resolveSpineRender(layout, title, author, spineWidthMm);
  const coverColor = resolveCoverColor(layout);
  const advanced = getAdvancedCover(layout);
  const flatImage = advanced.flatImage;

  return (
    <svg
      width={widthPx}
      height={svgHeight}
      viewBox={`0 0 ${widthPx} ${svgHeight}`}
      className="block mx-auto bg-parchment-50 rounded-lg shadow-sm"
      style={{ cursor: onSelectOverlay ? 'default' : 'inherit' }}
      onClick={(e) => {
        // Deselect when clicking on empty svg area
        if (onSelectOverlay && e.target === e.currentTarget) onSelectOverlay(null);
      }}
    >
      {/* White fill (paper outside trim) */}
      <rect x={0} y={0} width={widthPx} height={svgHeight} fill="#ffffff" />

      {mode === 'advanced' && flatImage && (
        // Advanced: one flat image fills the whole cover
        <image
          href={flatImage}
          x={0} y={0} width={widthPx} height={svgHeight}
          preserveAspectRatio="xMidYMid slice"
        />
      )}

      {mode === 'simplified' && (
        <>
          {/* Back cover image (left) */}
          {layout?.coverBack && (
            <image
              href={layout.coverBack}
              x={m2p(backX)} y={m2p(trimTop)}
              width={m2p(backWidthMm)} height={m2p(trimBottom - trimTop)}
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          {!layout?.coverBack && (
            <rect
              x={m2p(backX)} y={m2p(trimTop)}
              width={m2p(backWidthMm)} height={m2p(trimBottom - trimTop)}
              fill={coverColor}
            />
          )}

          {/* Spine */}
          <rect
            x={m2p(spineX)} y={m2p(trimTop)}
            width={m2p(spineWidthMm)} height={m2p(trimBottom - trimTop)}
            fill={spineRender.color}
          />
          {spineRender.showText && (
            <SpineText
              x={m2p(spineX + spineWidthMm / 2)}
              y={m2p(svgHeight > 0 ? totalHeightMm / 2 : 0)}
              width={m2p(trimBottom - trimTop - 20)}
              fontSize={Math.max(m2p(spineWidthMm) * 0.45, 7)}
              fontStack={spineRender.fontStack}
              color={spineRender.textColor}
              orientation={spineRender.orientation}
              title={spineRender.title}
              author={spineRender.author}
            />
          )}

          {/* Front cover image (right) */}
          {layout?.coverFront && (
            <image
              href={layout.coverFront}
              x={m2p(frontX)} y={m2p(trimTop)}
              width={m2p(frontWidthMm)} height={m2p(trimBottom - trimTop)}
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          {!layout?.coverFront && (
            <g>
              <rect
                x={m2p(frontX)} y={m2p(trimTop)}
                width={m2p(frontWidthMm)} height={m2p(trimBottom - trimTop)}
                fill={coverColor}
              />
              <text
                x={m2p(frontX + frontWidthMm / 2)}
                y={m2p(totalHeightMm / 2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={m2p(frontWidthMm) * 0.06}
                fontFamily="'Playfair Display', serif"
                fontWeight="bold"
                fill="#ffffff"
              >
                {title || 'Titre du livre'}
              </text>
              <text
                x={m2p(frontX + frontWidthMm / 2)}
                y={m2p(totalHeightMm / 2) + m2p(frontWidthMm) * 0.05}
                textAnchor="middle"
                fontSize={m2p(frontWidthMm) * 0.03}
                fontFamily="'Inter', sans-serif"
                fill="#fff8"
              >
                {author || 'Auteur'}
              </text>
            </g>
          )}
        </>
      )}

      {/* Advanced mode: render overlays on top of the flat image */}
      {mode === 'advanced' && advanced.overlays?.map((o) => (
        <OverlayElement
          key={o.id}
          overlay={o}
          widthPx={widthPx}
          heightPx={svgHeight}
          totalWidthMm={totalWidthMm}
          selected={selectedOverlayId === o.id}
          onClick={(e) => {
            if (onSelectOverlay) {
              e.stopPropagation();
              onSelectOverlay(o.id);
            }
          }}
        />
      ))}

      {showGuides && (
        <Guides
          widthPx={widthPx}
          heightPx={svgHeight}
          bleedPx={m2p(bleedMm)}
          spineStartPx={m2p(spineX)}
          spineEndPx={m2p(spineX + spineWidthMm)}
          safetyPx={m2p(5)}
        />
      )}
    </svg>
  );
}

// ─── Spine vertical text ───

function SpineText({
  x, y, width, fontSize, fontStack, color, orientation, title, author,
}: {
  x: number; y: number; width: number; fontSize: number; fontStack: string; color: string;
  orientation: 'ttb' | 'btt'; title: string; author?: string;
}) {
  // Combine title and optional author with a separator
  const label = author ? `${title} — ${author}` : title;
  // Text orientation: ttb = titre lisible tête en haut (lecture descendante, standard américain)
  //                    btt = lisible tête en bas (standard européen classique)
  const rot = orientation === 'ttb' ? 90 : -90;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fontFamily={fontStack}
      fill={color}
      fontWeight="600"
      transform={`rotate(${rot}, ${x}, ${y})`}
      style={{ userSelect: 'none' }}
    >
      <tspan>
        {label.length * fontSize * 0.6 > width
          ? label.slice(0, Math.max(Math.floor(width / (fontSize * 0.6)) - 1, 4)) + '…'
          : label}
      </tspan>
    </text>
  );
}

// ─── Overlay element renderer (advanced mode) ───

function OverlayElement({
  overlay, widthPx, heightPx, totalWidthMm, selected, onClick,
}: {
  overlay: CoverTextOverlay;
  widthPx: number;
  heightPx: number;
  totalWidthMm: number;
  selected: boolean;
  onClick?: (e: React.MouseEvent<SVGGElement>) => void;
}) {
  const x = (overlay.xPct / 100) * widthPx;
  const y = (overlay.yPct / 100) * heightPx;
  const w = (overlay.widthPct / 100) * widthPx;
  const h = (overlay.heightPct / 100) * heightPx;
  const cx = x + w / 2;
  const cy = y + h / 2;
  // fontSize is stored in "CSS px at 96 DPI reference" (1 px ≈ 0.2646 mm).
  // Scale to the current preview: preview renders totalWidthMm at widthPx,
  // so px/mm = widthPx/totalWidthMm. Real-world mm = fontSize * 0.2646.
  // CSS px at this preview scale = mm * (px/mm) = fontSize * 0.2646 * widthPx / totalWidthMm.
  const scaledFontSize = overlay.fontSize * (widthPx / totalWidthMm) * 0.2646;
  return (
    <g
      onClick={onClick}
      style={{ cursor: onClick ? 'move' : 'default' }}
      transform={`rotate(${overlay.rotation} ${cx} ${cy})`}
    >
      {selected && (
        <rect
          x={x} y={y} width={w} height={h}
          fill="none"
          stroke="#7a1b3a"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      )}
      <foreignObject x={x} y={y} width={w} height={h} style={{ overflow: 'visible' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: overlay.textAlign === 'left' ? 'flex-start'
              : overlay.textAlign === 'right' ? 'flex-end' : 'center',
            fontFamily: overlay.fontFamily,
            fontSize: `${scaledFontSize}px`,
            fontWeight: overlay.fontWeight,
            fontStyle: overlay.fontStyle,
            color: overlay.color,
            textAlign: overlay.textAlign,
            lineHeight: 1.1,
            overflow: 'hidden',
            textShadow: selected ? 'none' : undefined,
            userSelect: 'none',
          }}
        >
          {overlay.content}
        </div>
      </foreignObject>
    </g>
  );
}

// ─── Guides overlay ───

function Guides({
  widthPx, heightPx, bleedPx, spineStartPx, spineEndPx, safetyPx,
}: {
  widthPx: number; heightPx: number; bleedPx: number; spineStartPx: number; spineEndPx: number; safetyPx: number;
}) {
  return (
    <g fill="none" pointerEvents="none">
      {/* Bleed outer border (red) */}
      <rect x={0} y={0} width={widthPx} height={heightPx} stroke="#e53e3e" strokeWidth={0.5} />
      {/* Trim line (red solid) */}
      <rect
        x={bleedPx} y={bleedPx}
        width={widthPx - 2 * bleedPx}
        height={heightPx - 2 * bleedPx}
        stroke="#e53e3e"
        strokeWidth={0.7}
      />
      {/* Safety zone for back */}
      <rect
        x={bleedPx + safetyPx} y={bleedPx + safetyPx}
        width={spineStartPx - bleedPx - 2 * safetyPx}
        height={heightPx - 2 * (bleedPx + safetyPx)}
        stroke="#059669"
        strokeWidth={0.4}
        strokeDasharray="3 2"
      />
      {/* Safety zone for front */}
      <rect
        x={spineEndPx + safetyPx} y={bleedPx + safetyPx}
        width={widthPx - spineEndPx - bleedPx - 2 * safetyPx}
        height={heightPx - 2 * (bleedPx + safetyPx)}
        stroke="#059669"
        strokeWidth={0.4}
        strokeDasharray="3 2"
      />
      {/* Spine guides (blue) */}
      <line x1={spineStartPx} y1={bleedPx} x2={spineStartPx} y2={heightPx - bleedPx} stroke="#3b82f6" strokeWidth={0.5} strokeDasharray="3 2" />
      <line x1={spineEndPx} y1={bleedPx} x2={spineEndPx} y2={heightPx - bleedPx} stroke="#3b82f6" strokeWidth={0.5} strokeDasharray="3 2" />
    </g>
  );
}
