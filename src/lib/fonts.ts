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
