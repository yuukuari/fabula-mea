/**
 * Cover composition helpers.
 *
 * The cover editor supports two modes:
 *   1. Simplified — front + back + spine (auto-rendered as solid color + optional title text)
 *   2. Advanced  — flat image background + positioned text overlays
 *
 * This module exposes defaults, SVG renderers and utilities for drag/resize
 * math used by the overlay editor.
 */
import type { BookLayout, CoverMode, CoverSimplifiedConfig, CoverAdvancedConfig, CoverTextOverlay, BookFont } from '@/types';
import { FONT_STACKS } from '@/lib/fonts';

/** Threshold below which the spine is considered "too thin for text". */
export const SPINE_MIN_TEXT_MM = 6;

export const DEFAULT_SIMPLIFIED_COVER: CoverSimplifiedConfig = {
  spineColor: '#7a1b3a',             // bordeaux — matches the app palette
  spineShowTitle: true,
  spineTextColor: '#fafafa',
  spineOrientation: 'ttb',
};

export const DEFAULT_ADVANCED_COVER: CoverAdvancedConfig = {
  overlays: [],
};

export function getCoverMode(layout: BookLayout | undefined): CoverMode {
  return layout?.coverMode ?? 'simplified';
}

export function getSimplifiedCover(layout: BookLayout | undefined): CoverSimplifiedConfig {
  return { ...DEFAULT_SIMPLIFIED_COVER, ...(layout?.coverSimplified ?? {}) };
}

export function getAdvancedCover(layout: BookLayout | undefined): CoverAdvancedConfig {
  return { ...DEFAULT_ADVANCED_COVER, ...(layout?.coverAdvanced ?? {}) };
}

export interface SpineRenderProps {
  color: string;
  showText: boolean;
  title: string;
  author?: string;
  fontStack: string;
  textColor: string;
  orientation: 'ttb' | 'btt';
}

/** Build the effective spine render props for the simplified mode. */
export function resolveSpineRender(
  layout: BookLayout | undefined,
  title: string,
  author: string,
  spineWidthMm: number,
): SpineRenderProps {
  const sc = getSimplifiedCover(layout);
  const bookFont = layout?.fontFamily ?? 'Times New Roman';
  const spineFont = sc.spineFontFamily ?? bookFont;
  const fontStack = FONT_STACKS[spineFont as BookFont] ?? FONT_STACKS[bookFont];
  return {
    color: sc.spineColor ?? DEFAULT_SIMPLIFIED_COVER.spineColor!,
    showText: (sc.spineShowTitle ?? true) && spineWidthMm >= SPINE_MIN_TEXT_MM,
    title,
    author,
    fontStack,
    textColor: sc.spineTextColor ?? DEFAULT_SIMPLIFIED_COVER.spineTextColor!,
    orientation: sc.spineOrientation ?? 'ttb',
  };
}

/**
 * Generate an initial set of overlays for the advanced mode when the user
 * switches from simplified → advanced (gives them a starting point to edit).
 */
export function defaultOverlaysFor(title: string, author: string): CoverTextOverlay[] {
  const now = Date.now();
  // Positions in percent of the flat cover (back | spine | front)
  // Front cover is roughly the right third.
  return [
    {
      id: `overlay-${now}-1`,
      xPct: 68, yPct: 18, widthPct: 30, heightPct: 12,
      rotation: 0,
      content: title || 'Titre du livre',
      fontFamily: 'Playfair Display',
      fontSize: 32, color: '#ffffff',
      fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center',
    },
    {
      id: `overlay-${now}-2`,
      xPct: 68, yPct: 82, widthPct: 30, heightPct: 6,
      rotation: 0,
      content: author || 'Auteur',
      fontFamily: 'Inter',
      fontSize: 14, color: '#ffffff',
      fontWeight: 'normal', fontStyle: 'italic', textAlign: 'center',
    },
  ];
}
