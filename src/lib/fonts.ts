import type { BookFont } from '@/types';

/** CSS font-family stacks for each BookFont option */
export const FONT_STACKS: Record<BookFont, string> = {
  'Times New Roman': '"Times New Roman", Times, serif',
  'Georgia': 'Georgia, "Times New Roman", serif',
  'Crimson Text': '"Crimson Text", Georgia, serif',
  'Lora': 'Lora, Georgia, serif',
  'Merriweather': 'Merriweather, Georgia, serif',
  'EB Garamond': '"EB Garamond", Garamond, serif',
  'Libre Baskerville': '"Libre Baskerville", Georgia, serif',
  'Garamond': 'Garamond, "EB Garamond", serif',
};

/**
 * Average character width as a fraction of font-size, for justified body text
 * in French. Used by the paginator to estimate how many characters fit per
 * line. Values are calibrated against rendered DOM measurements; ±0.02 of
 * accuracy is sufficient.
 */
export const FONT_WIDTH_FACTOR: Record<BookFont, number> = {
  'Times New Roman': 0.42,
  'Georgia': 0.46,
  'Crimson Text': 0.43,
  'Lora': 0.46,
  'Merriweather': 0.49,
  'EB Garamond': 0.40,
  'Libre Baskerville': 0.46,
  'Garamond': 0.40,
};

/** All available fonts for UI selectors */
export const AVAILABLE_FONTS: BookFont[] = [
  'Times New Roman',
  'Georgia',
  'Garamond',
  'Crimson Text',
  'Lora',
  'Merriweather',
  'EB Garamond',
  'Libre Baskerville',
];

/** Available font sizes */
export const AVAILABLE_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18] as const;

/** Available line heights */
export const AVAILABLE_LINE_HEIGHTS = [1.0, 1.15, 1.25, 1.5, 1.75, 2.0] as const;

/** Default layout values */
export const DEFAULT_LAYOUT = {
  fontFamily: 'Times New Roman' as BookFont,
  fontSize: 12 as const,
  lineHeight: 1.5 as const,
};
