/**
 * Shared utilities for EPUB, PDF and DOCX export.
 */
import type { BookLayout } from '@/types';

export interface ExportChapter {
  id?: string;
  number: number;
  title: string;
  type?: 'front_matter' | 'chapter' | 'back_matter';
  scenes: { title: string; content: string }[];
}

export interface ExportMap {
  id: string;
  name: string;
  imageUrl: string;
}

export interface ExportBook {
  title: string;
  author: string;
  genre: string;
  synopsis: string;
  chapters: ExportChapter[];
  glossary?: { name: string; type: string; description: string }[];
  maps?: ExportMap[];
  layout?: BookLayout;
  tableOfContents?: boolean;
  /** Cover images resolved by the caller (handles advanced mode cropping).
   * Exports should prefer these over `layout.coverFront`/`coverBack`. */
  resolvedCoverFront?: string;
  resolvedCoverBack?: string;
}

/** Escape special XML/HTML characters to prevent injection */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Clean TipTap HTML for export (XHTML-compatible) */
export function cleanHtml(html: string): string {
  if (!html) return '<p></p>';
  return html
    // Close self-closing tags for XHTML
    .replace(/<br>/g, '<br/>')
    .replace(/<hr>/g, '<hr/>')
    .replace(/<img([^>]*?)>/g, '<img$1/>')
    // Remove editor-specific class attributes
    .replace(/\s+class="[^"]*"/g, '')
    // Remove data-attributes
    .replace(/\s+data-[a-z-]+="[^"]*"/g, '')
    // Clean empty spans left by TipTap
    .replace(/<span>\s*<\/span>/g, '')
    // Normalize text-align styles
    .replace(/style="text-align:\s*(center|right|justify|left)"/g, 'style="text-align: $1"')
    // Convert HTML entities to numeric (XHTML-safe)
    .replace(/&nbsp;/g, '&#160;')
    .replace(/&mdash;/g, '&#8212;')
    .replace(/&ndash;/g, '&#8211;')
    .replace(/&laquo;/g, '&#171;')
    .replace(/&raquo;/g, '&#187;')
    .replace(/&hellip;/g, '&#8230;')
    .replace(/&amp;nbsp;/g, '&#160;');
}
