import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, BookOpen, LayoutGrid, Ruler } from 'lucide-react';
import { PageFlip } from 'page-flip';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { DEFAULT_LAYOUT, FONT_STACKS } from '@/lib/fonts';
import {
  paginateContent, getTrimSize, getPaperType, DEFAULT_PRINT_EDITION,
  calculateCoverDimensions, estimatePageCount,
  type BookPageData, type CoverDimensions,
} from '@/lib/print-edition';
import type { PrintEdition } from '@/types';
import { PageRuler } from './PageRuler';
import { getCoverMode, getAdvancedCover } from '@/lib/cover-composition';
import { CoverFlatPreview } from './CoverFlatPreview';
import { totalScenesCount, isSpecialChapter } from '@/lib/utils';

type ViewMode = 'flip' | 'grid' | 'actual-size';
/** 1 inch = 2.54 cm at 96 CSS DPI. */
const MM_PER_CSS_PX = 25.4 / 96;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BookReader({ open, onClose }: Props) {
  const layout = useBookStore((s) => s.layout);
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const glossaryEnabled = useBookStore((s) => s.glossaryEnabled);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const { characters, places, worldNotes } = useEncyclopediaStore();

  const printEdition: PrintEdition = layout?.printEdition ?? DEFAULT_PRINT_EDITION;
  const trim = getTrimSize(printEdition.trimSize);
  const paper = getPaperType(printEdition.paperType);
  const fontFamily = layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily;
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const fontStack = FONT_STACKS[fontFamily];

  // Resolve covers — in advanced mode, the flat image contains back+spine+front
  // and takes priority over simplified covers (even if the user has leftover
  // simplified uploads from a previous session).
  const coverMode = getCoverMode(layout);
  const advancedFlat = coverMode === 'advanced' ? getAdvancedCover(layout).flatImage : undefined;
  const isAdvanced = coverMode === 'advanced' && !!advancedFlat;
  const resolvedCoverFront = isAdvanced ? advancedFlat : layout?.coverFront;
  const resolvedCoverBack = isAdvanced ? advancedFlat : layout?.coverBack;

  // Compute full cover dimensions (flat spread) — used in advanced mode to
  // clip the flat image to the front/back trim in the reader.
  const coverDims: CoverDimensions | null = useMemo(() => {
    if (!isAdvanced || !layout?.printEdition) return null;
    const pe = layout.printEdition;
    const totalCount = totalScenesCount(scenes, countUnit);
    const chapterCount = chapters.filter((c) => !isSpecialChapter(c)).length;
    const pageCount = estimatePageCount(
      totalCount, pe.trimSize,
      layout.fontSize ?? DEFAULT_LAYOUT.fontSize,
      layout.lineHeight ?? DEFAULT_LAYOUT.lineHeight,
      pe.margins, chapterCount,
    );
    return calculateCoverDimensions(pe.trimSize, pageCount, pe.paperType, pe.bleedMm);
  }, [isAdvanced, layout, scenes, chapters, countUnit]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('flip');
  const [actualSizePageIndex, setActualSizePageIndex] = useState(0);

  // Build paginated content
  const pages: BookPageData[] = useMemo(() => {
    const sortedChapters = [...chapters]
      .sort((a, b) => a.number - b.number)
      .map((ch) => ({
        title: ch.title ?? '',
        type: ch.type,
        scenes: ch.sceneIds
          .map((sid) => scenes.find((s) => s.id === sid))
          .filter(Boolean)
          .sort((a, b) => a!.orderInChapter - b!.orderInChapter)
          .map((s) => ({ title: s!.title, content: s!.content })),
      }));

    const glossary = glossaryEnabled
      ? [
          ...characters.filter((c) => c.inGlossary).map((c) => ({ name: c.name, description: c.description || '' })),
          ...places.filter((p) => p.inGlossary).map((p) => ({ name: p.name, description: p.description || '' })),
          ...worldNotes.filter((w) => w.inGlossary).map((w) => ({ name: w.title, description: w.content || '' })),
        ].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      : undefined;

    return paginateContent({
      chapters: sortedChapters,
      glossary,
      layout,
      printEdition,
      title,
      author,
      coverFront: resolvedCoverFront,
      coverBack: resolvedCoverBack,
    });
  }, [chapters, scenes, glossaryEnabled, characters, places, worldNotes, layout, printEdition, title, author, resolvedCoverFront, resolvedCoverBack]);

  // Ensure even number of pages for page-flip
  const displayPages = useMemo(() => {
    const p = [...pages];
    if (p.length % 2 !== 0) {
      p.push({ html: '', pageNumber: 0 });
    }
    return p;
  }, [pages]);

  // Calculate page dimensions to fit viewport
  const pageWidth = useMemo(() => {
    const maxW = Math.min(window.innerWidth * 0.42, 500);
    const maxH = window.innerHeight * 0.8;
    const ratio = trim.widthMm / trim.heightMm;
    const fromHeight = maxH * ratio;
    return Math.min(maxW, fromHeight);
  }, [trim]);
  const pageHeight = pageWidth / (trim.widthMm / trim.heightMm);

  const m = printEdition.margins;
  const topPct = (m.topMm / trim.heightMm) * 100;
  const bottomPct = (m.bottomMm / trim.heightMm) * 100;
  const innerPct = (m.innerMm / trim.widthMm) * 100;
  const outerPct = (m.outerMm / trim.widthMm) * 100;

  // Initialize page-flip (only in flip mode).
  //
  // Under React.StrictMode (dev), effects run twice. The first run's cleanup
  // fails to fully undo page-flip's DOM mutations (destroy() can throw), so
  // the second run inits on a mangled DOM and breaks silently — covers don't
  // render and flipNext/flipPrev do nothing. We defer the init by a tick so
  // StrictMode's cleanup gets a chance to abort the first attempt before any
  // DOM is touched.
  useEffect(() => {
    if (!open || viewMode !== 'flip' || !containerRef.current || displayPages.length === 0) return;

    let aborted = false;
    const timer = setTimeout(() => {
      if (aborted) return;
      const container = containerRef.current;
      if (!container) return;

      const pf = new PageFlip(container, {
        width: pageWidth,
        height: pageHeight,
        size: 'fixed',
        showCover: true,
        maxShadowOpacity: 0.5,
        drawShadow: true,
        mobileScrollSupport: false,
        usePortrait: false,
        flippingTime: 600,
      });
      pageFlipRef.current = pf;

      const pagesEl = container.querySelectorAll('.page-flip-page');
      if (pagesEl.length > 0) {
        pf.loadFromHTML(pagesEl as unknown as HTMLElement[]);
        pf.on('flip', (e: { data: number }) => {
          // Guard against events arriving after destroy
          if (!pageFlipRef.current) return;
          setCurrentPage(e.data);
        });
      }
    }, 0);

    return () => {
      aborted = true;
      clearTimeout(timer);
      const pf = pageFlipRef.current;
      pageFlipRef.current = null;
      if (pf) {
        try { pf.destroy(); } catch { /* noop */ }
      }
    };
    // Re-init when pages content changes (not just length), so edits in the
    // underlying book reflect in the reader immediately.
  }, [open, viewMode, displayPages, pageWidth, pageHeight]);

  const handlePrev = useCallback(() => {
    // page-flip may throw if its internals are not ready or already destroyed.
    try { pageFlipRef.current?.flipPrev(); } catch { /* noop */ }
  }, []);

  const handleNext = useCallback(() => {
    try { pageFlipRef.current?.flipNext(); } catch { /* noop */ }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (viewMode === 'flip') {
        if (e.key === 'ArrowLeft') handlePrev();
        else if (e.key === 'ArrowRight') handleNext();
      } else if (viewMode === 'actual-size') {
        if (e.key === 'ArrowLeft') setActualSizePageIndex((i) => Math.max(0, i - 1));
        else if (e.key === 'ArrowRight') setActualSizePageIndex((i) => Math.min(pages.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, viewMode, handlePrev, handleNext, onClose, pages.length]);

  // Hide body scrollbar while reader is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  // page-flip overrides inline styles on the outer .page-flip-page element,
  // so we use an inner wrapper with width/height 100% that carries the
  // background color and all visual content.
  //
  // When `scale === 1`, the rendered font size matches the actual pt chosen
  // by the user (used for actual-size preview). When scale < 1, the font is
  // shrunk proportionally (used for thumbnails / flip view).

  const renderPageInner = (page: BookPageData, scale: number = 0.6) => {
    // Cover front
    if (page.isCover === 'front') {
      // Advanced mode: render the flat cover (image + overlays) clipped to
      // the front trim area.
      if (isAdvanced && advancedFlat && coverDims) {
        return (
          <ClippedFlatCover
            side="front"
            layout={layout}
            dims={coverDims}
            trimWidthMm={trim.widthMm}
            title={title}
            author={author}
          />
        );
      }
      if (layout?.coverFront) {
        return <img src={layout.coverFront} alt="Couverture" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
      }
      return (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #8b2252, #5a1636)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'white', padding: '10%', boxSizing: 'border-box',
        }}>
          <p style={{ fontFamily: '"Playfair Display", serif', fontWeight: 'bold', fontSize: '1.4em', textAlign: 'center' }}>{title}</p>
          <p style={{ fontSize: '0.8em', marginTop: 8, opacity: 0.7 }}>{author}</p>
        </div>
      );
    }

    // Cover back
    if (page.isCover === 'back') {
      if (isAdvanced && advancedFlat && coverDims) {
        return (
          <ClippedFlatCover
            side="back"
            layout={layout}
            dims={coverDims}
            trimWidthMm={trim.widthMm}
            title={title}
            author={author}
          />
        );
      }
      if (layout?.coverBack) {
        return <img src={layout.coverBack} alt="4ème" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
      }
      return <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #5a1636, #3d0f24)' }} />;
    }

    // Title page
    if (page.isTitlePage) {
      return (
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: paper.color,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '15%', fontFamily: fontStack, boxSizing: 'border-box',
        }}>
          <p style={{ fontSize: fontSize * 2.5 * scale, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2, color: '#333' }}>{title}</p>
          <p style={{ fontSize: fontSize * 1.3 * scale, marginTop: 16 * scale, color: '#666', fontStyle: 'italic' }}>{author}</p>
        </div>
      );
    }

    // Blank page
    if (!page.html && !page.chapterTitle) {
      return <div style={{ width: '100%', height: '100%', backgroundColor: paper.color }} />;
    }

    // Content page.
    // Inner margin is on the spine side and alternates:
    // - Recto (odd pageNumber, right side of spread) → inner on LEFT
    // - Verso (even pageNumber, left side of spread) → inner on RIGHT
    // Pages with pageNumber 0 (covers, blank filler) default to recto-style.
    const contentFontSize = scale === 1 ? fontSize : Math.max(fontSize * scale, 6);
    const isVerso = page.pageNumber > 0 && page.pageNumber % 2 === 0;
    const leftPct = isVerso ? outerPct : innerPct;
    const rightPct = isVerso ? innerPct : outerPct;
    return (
      <div style={{
        width: '100%', height: '100%',
        backgroundColor: paper.color,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div
          style={{
            position: 'absolute',
            top: `${topPct}%`,
            bottom: `${bottomPct}%`,
            left: `${leftPct}%`,
            right: `${rightPct}%`,
            fontFamily: fontStack,
            fontSize: `${contentFontSize}pt`,
            lineHeight,
            color: '#333',
            overflow: 'hidden',
          }}
        >
          {page.chapterTitle && (
            <h2 style={{ fontSize: '1.4em', fontWeight: 'bold', marginBottom: '0.5em', textAlign: 'center', color: '#222' }}>
              {page.chapterTitle}
            </h2>
          )}
          {page.sceneTitle && (
            <h3 style={{ fontSize: '1.1em', fontWeight: 600, marginBottom: '0.4em', color: '#444' }}>
              {page.sceneTitle}
            </h3>
          )}
          <div dangerouslySetInnerHTML={{ __html: page.html }} style={{ overflow: 'hidden' }} />
        </div>

        {page.pageNumber > 0 && (
          <span style={{
            position: 'absolute',
            bottom: `${bottomPct * 0.3}%`,
            left: '50%', transform: 'translateX(-50%)',
            fontSize: `${7 * Math.max(scale, 0.5)}pt`, color: '#aaa',
          }}>
            {page.pageNumber}
          </span>
        )}
      </div>
    );
  };

  // Actual-size: one page at 1:1 physical size (using 96 CSS DPI)
  const actualSizePageWidthPx = trim.widthMm / MM_PER_CSS_PX;
  const actualSizePageHeightPx = trim.heightMm / MM_PER_CSS_PX;

  // Grid thumbnails: scale to fit
  const thumbWidth = 140;
  const thumbHeight = thumbWidth / (trim.widthMm / trim.heightMm);

  // Font scales derived from the page size ratio so the text looks
  // proportionally identical across the three modes.
  const flipScale = pageWidth / actualSizePageWidthPx;
  const thumbScale = thumbWidth / actualSizePageWidthPx;

  const renderPage = (page: BookPageData, index: number) => {
    const isCover = page.isCover === 'front' || page.isCover === 'back';
    return (
      <div
        key={`page-${index}`}
        className="page-flip-page"
        {...(isCover ? { 'data-density': 'hard' } : {})}
      >
        <div style={{
          width: '100%', height: '100%',
          backgroundColor: isCover ? '#333' : paper.color,
          overflow: 'hidden',
        }}>
          {renderPageInner(page, flipScale)}
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(15,15,15,1)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        {/* Page indicator */}
        <div className="text-white/60 text-sm min-w-[120px]">
          {viewMode === 'flip' && `Page ${currentPage + 1} / ${displayPages.length}`}
          {viewMode === 'grid' && `${pages.length} page${pages.length > 1 ? 's' : ''}`}
          {viewMode === 'actual-size' && `Page ${actualSizePageIndex + 1} / ${pages.length} · taille réelle`}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/10">
          <ModeButton active={viewMode === 'flip'} onClick={() => setViewMode('flip')} icon={BookOpen} label="Feuilleter" />
          <ModeButton active={viewMode === 'grid'} onClick={() => setViewMode('grid')} icon={LayoutGrid} label="Grille" />
          <ModeButton active={viewMode === 'actual-size'} onClick={() => setViewMode('actual-size')} icon={Ruler} label="Taille réelle" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors min-w-[120px] flex justify-end"
          aria-label="Fermer"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Content area.
          Flip mode: `overflow-hidden` clips the curling page animation —
          page-flip renders the turning page slightly outside its container
          which would otherwise trigger a horizontal scrollbar. */}
      <div
        className={`flex-1 flex justify-center p-4 ${
          viewMode === 'flip'
            ? 'items-center overflow-hidden'
            // Non-flip modes can have content taller than the viewport (grid
            // with many thumbnails, actual-size on a big monitor). Align to
            // top so the scroll starts at page 1, not in the middle.
            : 'items-start overflow-auto'
        }`}
      >
        {viewMode === 'flip' && (
          <div className="flex items-center gap-4">
            <button onClick={handlePrev} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>

            <div
              className="relative"
              style={{ width: `${pageWidth * 2}px`, height: `${pageHeight}px` }}
            >
              <div
                ref={containerRef}
                style={{ width: '100%', height: '100%' }}
              >
                {displayPages.map((page, i) => renderPage(page, i))}
              </div>
              {/* Per-page inner shadow at the spine is applied via CSS
                  (`.stf__item` selectors in index.css). The shadow is a
                  property of each page and moves with it during flipping,
                  so the turning page naturally carries its own gutter
                  shading — no z-index juggling needed. */}
            </div>

            <button onClick={handleNext} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="w-full max-w-6xl mx-auto overflow-y-auto">
            <div
              className="grid gap-4 p-4"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbWidth}px, 1fr))` }}
            >
              {pages.map((page, i) => {
                const isCover = page.isCover === 'front' || page.isCover === 'back';
                return (
                  <button
                    key={`grid-${i}`}
                    onClick={() => {
                      setActualSizePageIndex(i);
                      setViewMode('actual-size');
                    }}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div
                      style={{
                        width: thumbWidth,
                        height: thumbHeight,
                        backgroundColor: isCover ? '#333' : paper.color,
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                      className="transition-transform group-hover:scale-105"
                    >
                      {renderPageInner(page, thumbScale)}
                    </div>
                    <span className="text-white/40 text-xs group-hover:text-white/80 transition-colors">
                      {i + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'actual-size' && pages[actualSizePageIndex] && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-white/60 text-xs italic max-w-md text-center">
              Cette page est affichée à sa taille physique réelle (environ {trim.widthMm} × {trim.heightMm} mm).
              Si le texte est difficile à lire ici, il le sera aussi à l'impression — pensez à augmenter
              la taille de police.
            </div>

            <PageRuler widthMm={trim.widthMm} widthPx={actualSizePageWidthPx} color="#999" />

            <div
              style={{
                width: actualSizePageWidthPx,
                height: actualSizePageHeightPx,
                backgroundColor: paper.color,
                overflow: 'hidden',
                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {renderPageInner(pages[actualSizePageIndex], 1)}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setActualSizePageIndex((i) => Math.max(0, i - 1))}
                disabled={actualSizePageIndex === 0}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <span className="text-white/60 text-sm">
                Page {actualSizePageIndex + 1} / {pages.length}
              </span>
              <button
                onClick={() => setActualSizePageIndex((i) => Math.min(pages.length - 1, i + 1))}
                disabled={actualSizePageIndex === pages.length - 1}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="text-center pb-3 text-white/30 text-xs">
        {viewMode === 'flip' && <>← → pour naviguer · Échap pour fermer</>}
        {viewMode === 'grid' && <>Cliquez sur une page pour la voir à taille réelle · Échap pour fermer</>}
        {viewMode === 'actual-size' && <>← → pour changer de page · Échap pour fermer</>}
      </p>
    </div>,
    document.body
  );
}

function ModeButton({ active, onClick, icon: Icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
        active ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/**
 * Render the front or back trim of an advanced (flat) cover inside the
 * reader's trim-sized page. Reuses CoverFlatPreview so text overlays are
 * positioned consistently with the rest of the app, and clips the output to
 * show only the requested side.
 */
function ClippedFlatCover({
  side, layout, dims, trimWidthMm, title, author,
}: {
  side: 'front' | 'back';
  layout: import('@/types').BookLayout | undefined;
  dims: CoverDimensions;
  trimWidthMm: number;
  title: string;
  author: string;
}) {
  // The parent page element has width = trim.widthMm (scaled to CSS px). We
  // compute everything in percentages relative to that trim, which makes the
  // clipping resolution-independent (preview, grid thumbnails, actual-size).
  const ratioFlat = dims.totalWidthMm / trimWidthMm;
  const fullWidthPct = ratioFlat * 100;
  // mm offset where the trim region of the requested side starts within the
  // flat spread:
  const regionStartMm = side === 'front'
    ? dims.bleedMm + dims.backWidthMm + dims.spineWidthMm
    : dims.bleedMm;
  const offsetLeftPct = -(regionStartMm / trimWidthMm) * 100;
  // Vertical: we want to show the trim area (not the top/bottom bleed).
  // Parent height = trim.heightMm; flat preview height = totalHeightMm.
  const ratioFlatV = dims.totalHeightMm / (dims.totalHeightMm - 2 * dims.bleedMm);
  const fullHeightPct = ratioFlatV * 100;
  const offsetTopPct = -(dims.bleedMm / (dims.totalHeightMm - 2 * dims.bleedMm)) * 100;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          left: `${offsetLeftPct}%`,
          top: `${offsetTopPct}%`,
          width: `${fullWidthPct}%`,
          height: `${fullHeightPct}%`,
        }}
      >
        {/* CoverFlatPreview scales to whatever widthPx fills the wrapper. We
            let it render at the wrapper's full width via a ResizeObserver-free
            trick: wrap it in a CSS size container using a ref. Simpler: pass a
            reasonably large widthPx — the SVG viewBox handles the rest.       */}
        <CoverFlatPreviewAutoWidth
          layout={layout}
          dims={dims}
          title={title}
          author={author}
        />
      </div>
    </div>
  );
}

/** CoverFlatPreview that auto-fits its CSS-pixel width to its parent. */
function CoverFlatPreviewAutoWidth({
  layout, dims, title, author,
}: {
  layout: import('@/types').BookLayout | undefined;
  dims: CoverDimensions;
  title: string;
  author: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState<number>(800);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidthPx(Math.round(w));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <CoverFlatPreview
        layout={layout}
        dims={dims}
        title={title}
        author={author}
        widthPx={widthPx}
      />
    </div>
  );
}
