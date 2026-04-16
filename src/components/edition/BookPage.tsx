import { forwardRef } from 'react';
import type { BookPageData } from '@/lib/print-edition';
import type { BookLayout } from '@/types';
import { FONT_STACKS, DEFAULT_LAYOUT } from '@/lib/fonts';
import { getPaperType, getTrimSize, DEFAULT_PRINT_EDITION } from '@/lib/print-edition';
import type { PrintEdition } from '@/types';

interface Props {
  page: BookPageData;
  layout?: BookLayout;
  printEdition?: PrintEdition;
  title: string;
  author: string;
}

export const BookPage = forwardRef<HTMLDivElement, Props>(function BookPage(
  { page, layout, printEdition, title, author },
  ref,
) {
  const pe = printEdition ?? DEFAULT_PRINT_EDITION;
  const paper = getPaperType(pe.paperType);
  const trim = getTrimSize(pe.trimSize);
  const fontFamily = layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily;
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const fontStack = FONT_STACKS[fontFamily];

  const m = pe.margins;
  const topPct = (m.topMm / trim.heightMm) * 100;
  const bottomPct = (m.bottomMm / trim.heightMm) * 100;
  const innerPct = (m.innerMm / trim.widthMm) * 100;
  const outerPct = (m.outerMm / trim.widthMm) * 100;

  // Cover pages
  if (page.isCover === 'front') {
    return (
      <div ref={ref} className="page-flip-page" style={{ backgroundColor: '#333' }}>
        {layout?.coverFront ? (
          <img src={layout.coverFront} alt="Couverture" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-bordeaux-600 to-bordeaux-800 flex flex-col items-center justify-center text-white p-8">
            <p className="font-display font-bold text-2xl text-center leading-tight">{title}</p>
            <p className="text-sm mt-3 opacity-75">{author}</p>
          </div>
        )}
      </div>
    );
  }

  if (page.isCover === 'back') {
    return (
      <div ref={ref} className="page-flip-page" style={{ backgroundColor: '#333' }}>
        {layout?.coverBack ? (
          <img src={layout.coverBack} alt="4ème de couverture" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-bordeaux-700 to-bordeaux-900" />
        )}
      </div>
    );
  }

  // Title page
  if (page.isTitlePage) {
    return (
      <div
        ref={ref}
        className="page-flip-page"
        style={{
          backgroundColor: paper.color,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '15%',
          fontFamily: fontStack,
        }}
      >
        <p style={{ fontSize: fontSize * 2, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2, color: '#333' }}>
          {title}
        </p>
        <p style={{ fontSize: fontSize * 1.2, marginTop: 16, color: '#666', fontStyle: 'italic' }}>
          {author}
        </p>
      </div>
    );
  }

  // Content page
  return (
    <div
      ref={ref}
      className="page-flip-page"
      style={{
        backgroundColor: paper.color,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: `${topPct}%`,
          bottom: `${bottomPct}%`,
          left: `${innerPct}%`,
          right: `${outerPct}%`,
          fontFamily: fontStack,
          fontSize: `${fontSize}pt`,
          lineHeight,
          color: '#333',
          overflow: 'hidden',
        }}
      >
        {page.chapterTitle && (
          <h2 style={{ fontSize: fontSize * 1.5, fontWeight: 'bold', marginBottom: '0.5em', textAlign: 'center', color: '#222' }}>
            {page.chapterTitle}
          </h2>
        )}
        {page.sceneTitle && (
          <h3 style={{ fontSize: fontSize * 1.2, fontWeight: '600', marginBottom: '0.4em', color: '#444' }}>
            {page.sceneTitle}
          </h3>
        )}
        <div dangerouslySetInnerHTML={{ __html: page.html }} />
      </div>

      {/* Page number */}
      {page.pageNumber > 0 && (
        <span
          style={{
            position: 'absolute',
            bottom: `${bottomPct * 0.4}%`,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '8pt',
            color: '#999',
          }}
        >
          {page.pageNumber}
        </span>
      )}
    </div>
  );
});
