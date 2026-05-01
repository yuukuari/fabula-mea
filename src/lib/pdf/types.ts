/**
 * Internal types for the PDF generation pipeline.
 *
 * The pipeline is: HTML (TipTap) → Block[] → laid-out pages → pdf-lib bytes.
 */

/** A single inline run of text with formatting flags. */
export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** A block-level element. */
export type Block =
  | { kind: 'paragraph'; runs: InlineRun[]; align?: 'left' | 'center' | 'right' | 'justify'; indent?: boolean }
  | { kind: 'heading'; level: 1 | 2 | 3; text: string; align?: 'left' | 'center' }
  | { kind: 'sceneTitle'; text: string }
  | { kind: 'sceneBreak' }
  | { kind: 'blockquote'; runs: InlineRun[] }
  | { kind: 'list'; ordered: boolean; items: InlineRun[][] }
  | { kind: 'pageBreak' }
  | { kind: 'rectoBreak' }; // page break + force start on recto (right-hand) page

/** Metadata describing the document's section start anchors (for TOC). */
export interface AnchorRecord {
  id: string;
  pageIndex: number; // 0-based
}

/** Per-PDF generation options. */
export interface PdfOptions {
  /** When true: alternating margins, blank pages, no covers, multiple-of-4 pages. */
  printMode: boolean;
  /** When true: include cover pages full-bleed (screen mode). */
  includeCovers: boolean;
}
