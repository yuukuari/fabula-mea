import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, BookOpen, LayoutGrid, Ruler } from 'lucide-react';
import { PageFlip } from 'page-flip';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { DEFAULT_LAYOUT, FONT_STACKS } from '@/lib/fonts';
import {
  paginateContent, getTrimSize, getPaperType, DEFAULT_PRINT_EDITION,
  type BookPageData,
} from '@/lib/print-edition';
import type { PrintEdition } from '@/types';
import { PageRuler } from './PageRuler';

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
  const { characters, places, worldNotes } = useEncyclopediaStore();

  const printEdition: PrintEdition = layout?.printEdition ?? DEFAULT_PRINT_EDITION;
  const trim = getTrimSize(printEdition.trimSize);
  const paper = getPaperType(printEdition.paperType);
  const fontFamily = layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily;
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const fontStack = FONT_STACKS[fontFamily];

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
      coverFront: layout?.coverFront,
      coverBack: layout?.coverBack,
    });
  }, [chapters, scenes, glossaryEnabled, characters, places, worldNotes, layout, printEdition, title, author]);

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

  // Initialize page-flip (only in flip mode)
  useEffect(() => {
    if (!open || viewMode !== 'flip' || !containerRef.current || displayPages.length === 0) return;

    const pf = new PageFlip(containerRef.current, {
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

    const pagesEl = containerRef.current.querySelectorAll('.page-flip-page');
    if (pagesEl.length > 0) {
      pf.loadFromHTML(pagesEl as unknown as HTMLElement[]);
      pf.on('flip', (e: { data: number }) => {
        // Guard against events arriving after destroy
        if (!pageFlipRef.current) return;
        setCurrentPage(e.data);
      });
    }

    return () => {
      if (pageFlipRef.current) {
        pageFlipRef.current.destroy();
        pageFlipRef.current = null;
      }
    };
    // Re-init when pages content changes (not just length), so edits in the
    // underlying book reflect in the reader immediately.
  }, [open, viewMode, displayPages, pageWidth, pageHeight]);

  const handlePrev = useCallback(() => {
    pageFlipRef.current?.flipPrev();
  }, []);

  const handleNext = useCallback(() => {
    pageFlipRef.current?.flipNext();
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

    // Content page
    const contentFontSize = scale === 1 ? fontSize : Math.max(fontSize * scale, 6);
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
            left: `${innerPct}%`,
            right: `${outerPct}%`,
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
          {renderPageInner(page)}
        </div>
      </div>
    );
  };

  // Actual-size: one page at 1:1 physical size (using 96 CSS DPI)
  const actualSizePageWidthPx = trim.widthMm / MM_PER_CSS_PX;
  const actualSizePageHeightPx = trim.heightMm / MM_PER_CSS_PX;

  // Grid thumbnails: scale to fit
  const thumbWidth = 140;
  const thumbHeight = thumbWidth / (trim.widthMm / trim.heightMm);

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

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        {viewMode === 'flip' && (
          <div className="flex items-center gap-4">
            <button onClick={handlePrev} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>

            <div
              ref={containerRef}
              style={{ width: `${pageWidth * 2}px`, height: `${pageHeight}px` }}
            >
              {displayPages.map((page, i) => renderPage(page, i))}
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
                      {renderPageInner(page, 0.28)}
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
