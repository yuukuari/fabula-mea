import { useState, useRef, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { DEFAULT_LAYOUT } from '@/lib/fonts';
import {
  getTrimSize, getPaperType, estimatePageCount, calculateSpineWidth,
  calculateCoverDimensions, DEFAULT_PRINT_EDITION,
} from '@/lib/print-edition';
import { totalScenesCount } from '@/lib/utils';
import { resolveSpineRender, getCoverMode, getAdvancedCover, resolveCoverColor } from '@/lib/cover-composition';

interface Props {
  onOpenReader: () => void;
}

export function BookPreview3D({ onOpenReader }: Props) {
  const layout = useBookStore((s) => s.layout);
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const scenes = useBookStore((s) => s.scenes);
  const chapters = useBookStore((s) => s.chapters);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');

  const printEdition = layout?.printEdition ?? DEFAULT_PRINT_EDITION;
  const trim = getTrimSize(printEdition.trimSize);
  const paper = getPaperType(printEdition.paperType);
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;

  const totalWords = totalScenesCount(scenes, countUnit);
  const chapterCount = chapters.filter((c) => c.type === 'chapter').length;
  const pageCount = estimatePageCount(totalWords, printEdition.trimSize, fontSize, lineHeight, printEdition.margins, chapterCount);
  const spineWidth = calculateSpineWidth(pageCount, printEdition.paperType);

  // 3D dimensions (scaled for display)
  const scale = 1.5;
  const bookW = trim.widthMm * scale;
  const bookH = trim.heightMm * scale;
  const bookD = Math.max(spineWidth * scale, 8); // min depth for visibility

  // Drag rotation
  const [rotation, setRotation] = useState({ x: -15, y: -25 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    // Capture on the drag area container, not the clicked child (img, text, etc.)
    dragAreaRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons === 0) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setRotation((r) => ({
      x: Math.max(-60, Math.min(60, r.x + dy * 0.5)),
      y: r.y + dx * 0.5,
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // In advanced mode, the flat image contains back+spine+front+bleed; we
  // crop it via CSS `backgroundImage` + `background-size/position` to show
  // only the front trim (1ère) on the front face and the back trim (4ème)
  // on the back face.
  const coverMode = getCoverMode(layout);
  const advancedFlat = coverMode === 'advanced' ? getAdvancedCover(layout).flatImage : undefined;
  const flatDims = advancedFlat
    ? calculateCoverDimensions(printEdition.trimSize, pageCount, printEdition.paperType, printEdition.bleedMm)
    : null;

  const coverFrontSrc = advancedFlat ?? layout?.coverFront;
  const coverBackSrc = advancedFlat ?? layout?.coverBack;
  const coverSpine = layout?.coverSpine;
  const hasContent = chapters.length > 0;
  const dragAreaRef = useRef<HTMLDivElement>(null);
  const [frontImgError, setFrontImgError] = useState(false);
  const [backImgError, setBackImgError] = useState(false);
  const coverFront = frontImgError ? undefined : coverFrontSrc;
  const coverBack = backImgError ? undefined : coverBackSrc;

  // Build CSS for cropping the flat image to a given side (front|back) of the
  // printed cover. Returns a style object with backgroundImage + size/position.
  const flatBgStyle = (side: 'front' | 'back'): React.CSSProperties | null => {
    if (!advancedFlat || !flatDims) return null;
    // Scale so trim width (what we show) maps to 100% of the face. Total
    // width / trim width tells us how big to render the image relative to
    // the face, then we shift so the correct portion is visible.
    //
    // CSS background-position percentage formula: for an image larger than
    // its container, position P% maps the image's P% point onto the
    // container's P% point. So to show a section starting at `startMm` of
    // the original (mm) flat, we need:
    //   P = startMm / (totalWidth - containerWidth) × 100
    const widthPct = (flatDims.totalWidthMm / trim.widthMm) * 100;
    const trimHeightMm = flatDims.totalHeightMm - 2 * flatDims.bleedMm;
    const heightPct = (flatDims.totalHeightMm / trimHeightMm) * 100;
    const startMm = side === 'front'
      ? flatDims.bleedMm + flatDims.backWidthMm + flatDims.spineWidthMm
      : flatDims.bleedMm;
    const leftPct = (startMm / (flatDims.totalWidthMm - trim.widthMm)) * 100;
    // Vertical: trim is centered between top and bottom bleed → 50%
    const topPct = 50;
    return {
      backgroundImage: `url(${advancedFlat})`,
      backgroundSize: `${widthPct}% ${heightPct}%`,
      backgroundPosition: `${leftPct}% ${topPct}%`,
      backgroundRepeat: 'no-repeat',
    };
  };

  // Auto-composed spine (simplified mode): color + optional vertical title
  const spineRender = resolveSpineRender(layout, title, author, spineWidth);
  const useAutoSpine = !coverSpine && coverMode === 'simplified';
  const coverColor = resolveCoverColor(layout);

  return (
    <div className="card-fantasy p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-ink-500">Prévisualisation</h3>
        {hasContent && (
          <button onClick={onOpenReader} className="btn-primary text-sm flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" />
            Feuilleter le livre
          </button>
        )}
      </div>

      {!hasContent ? (
        <p className="text-sm text-ink-300 text-center py-8 italic">
          Ajoutez du contenu à votre livre pour le prévisualiser.
        </p>
      ) : (
        <>
          <div
            ref={dragAreaRef}
            className="flex justify-center py-6 cursor-grab active:cursor-grabbing select-none"
            style={{ perspective: '1200px', touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div
              style={{
                width: bookW,
                height: bookH,
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                pointerEvents: 'none',
              }}
            >
              {/* Front cover */}
              <div
                style={{
                  position: 'absolute',
                  width: bookW,
                  height: bookH,
                  transform: `translateZ(${bookD / 2}px)`,
                  backfaceVisibility: 'hidden',
                  borderRadius: '2px 6px 6px 2px',
                  overflow: 'hidden',
                  boxShadow: '2px 2px 8px rgba(0,0,0,0.15)',
                }}
                className={coverFront ? 'border border-parchment-300' : ''}
              >
                {advancedFlat && flatDims ? (
                  <div className="w-full h-full" style={flatBgStyle('front') ?? undefined} />
                ) : coverFront ? (
                  <img src={coverFront} alt="Couverture" className="w-full h-full object-cover" onError={() => setFrontImgError(true)} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white p-4" style={{ backgroundColor: coverColor }}>
                    <p className="font-display font-bold text-base text-center leading-tight">{title || 'Mon livre'}</p>
                    <p className="text-xs mt-2 opacity-75">{author || 'Auteur'}</p>
                  </div>
                )}
              </div>

              {/* Back cover */}
              <div
                style={{
                  position: 'absolute',
                  width: bookW,
                  height: bookH,
                  transform: `translateZ(${-bookD / 2}px) rotateY(180deg)`,
                  backfaceVisibility: 'hidden',
                  borderRadius: '6px 2px 2px 6px',
                  overflow: 'hidden',
                }}
                className={coverBack ? 'border border-parchment-300' : ''}
              >
                {advancedFlat && flatDims ? (
                  <div className="w-full h-full" style={flatBgStyle('back') ?? undefined} />
                ) : coverBack ? (
                  <img src={coverBack} alt="4ème de couverture" className="w-full h-full object-cover" onError={() => setBackImgError(true)} />
                ) : (
                  <div className="w-full h-full" style={{ backgroundColor: coverColor }} />
                )}
              </div>

              {/* Spine */}
              <div
                style={{
                  position: 'absolute',
                  width: bookD,
                  height: bookH,
                  left: -bookD / 2,
                  transform: 'rotateY(-90deg)',
                  transformOrigin: 'right center',
                  backfaceVisibility: 'hidden',
                  overflow: 'hidden',
                  backgroundColor: useAutoSpine ? spineRender.color : !coverSpine && !advancedFlat ? coverColor : undefined,
                  // Advanced mode: crop the flat image to the spine strip.
                  ...(advancedFlat && flatDims ? (() => {
                    const trimHeightMm = flatDims.totalHeightMm - 2 * flatDims.bleedMm;
                    const widthPct = (flatDims.totalWidthMm / flatDims.spineWidthMm) * 100;
                    const heightPct = (flatDims.totalHeightMm / trimHeightMm) * 100;
                    const startMm = flatDims.bleedMm + flatDims.backWidthMm;
                    const leftPct = (startMm / (flatDims.totalWidthMm - flatDims.spineWidthMm)) * 100;
                    return {
                      backgroundImage: `url(${advancedFlat})`,
                      backgroundSize: `${widthPct}% ${heightPct}%`,
                      backgroundPosition: `${leftPct}% 50%`,
                      backgroundRepeat: 'no-repeat',
                    };
                  })() : {}),
                }}
                className={advancedFlat
                  ? ''
                  : coverSpine
                    ? ''
                    : useAutoSpine
                      ? 'flex items-center justify-center'
                      : 'flex items-center justify-center'}
              >
                {advancedFlat ? null : coverSpine ? (
                  <img src={coverSpine} alt="Dos" className="w-full h-full object-cover" />
                ) : (
                  bookD > 20 && (
                    <p
                      className="font-semibold whitespace-nowrap"
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        transform: spineRender.orientation === 'ttb' ? 'rotate(180deg)' : 'none',
                        maxHeight: bookH - 10,
                        overflow: 'hidden',
                        fontSize: Math.max(bookD * 0.35, 7),
                        fontFamily: useAutoSpine ? spineRender.fontStack : undefined,
                        color: useAutoSpine ? spineRender.textColor : '#ffffff',
                      }}
                    >
                      {title || 'Mon livre'} — {author || 'Auteur'}
                    </p>
                  )
                )}
              </div>

              {/* Right edge (pages) */}
              <div
                style={{
                  position: 'absolute',
                  width: bookD,
                  height: bookH,
                  right: -bookD / 2,
                  transform: 'rotateY(90deg)',
                  transformOrigin: 'left center',
                  backfaceVisibility: 'hidden',
                  backgroundColor: paper.color,
                  borderTop: '1px solid #ddd',
                  borderBottom: '1px solid #ddd',
                }}
              >
                {/* Page edge lines */}
                {Array.from({ length: Math.min(Math.floor(bookD / 2), 15) }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-full"
                    style={{
                      height: '0.5px',
                      backgroundColor: '#e0d8cc',
                      top: `${10 + (i * 80 / Math.min(Math.floor(bookD / 2), 15))}%`,
                    }}
                  />
                ))}
              </div>

              {/* Top edge */}
              <div
                style={{
                  position: 'absolute',
                  width: bookW,
                  height: bookD,
                  top: -bookD / 2,
                  transform: 'rotateX(90deg)',
                  transformOrigin: 'center bottom',
                  backfaceVisibility: 'hidden',
                  backgroundColor: paper.color,
                  borderLeft: `2px solid #8b2252`,
                  borderRight: '1px solid #ddd',
                }}
              />

              {/* Bottom edge */}
              <div
                style={{
                  position: 'absolute',
                  width: bookW,
                  height: bookD,
                  bottom: -bookD / 2,
                  transform: 'rotateX(-90deg)',
                  transformOrigin: 'center top',
                  backfaceVisibility: 'hidden',
                  backgroundColor: paper.color,
                  borderLeft: `2px solid #8b2252`,
                  borderRight: '1px solid #ddd',
                }}
              />
            </div>
          </div>

          <p className="text-center text-xs text-ink-200 mt-1">
            Glissez pour faire tourner le livre
          </p>
        </>
      )}
    </div>
  );
}
