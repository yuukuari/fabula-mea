import { describe, it, expect } from 'vitest';
import {
  cn,
  convertToSimpleDuration,
  computeEventEndDate,
  countCharacters,
  countWordsFromHtml,
  convertCount,
  countFromHtml,
  formatCount,
  countUnitLabel,
  isSpecialChapter,
  getChapterLabel,
  getChapterShortLabel,
  formatDuration,
  formatWritingTime,
  WORDS_TO_CHARS_RATIO,
} from '@/lib/utils';

// ─── cn ───

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b');
  });

  it('returns empty string when all falsy', () => {
    expect(cn(false, undefined, null)).toBe('');
  });
});

// ─── convertToSimpleDuration ───

describe('convertToSimpleDuration', () => {
  it('≤24h → hours', () => {
    const result = convertToSimpleDuration('2025-01-15T10:00:00', '2025-01-15T16:00:00');
    expect(result.duration.unit).toBe('hours');
    expect(result.duration.value).toBe(6);
    expect(result.startDate).toBe('2025-01-15');
    expect(result.startTime).toBe('10:00');
  });

  it('extracts no startTime when midnight', () => {
    const result = convertToSimpleDuration('2025-01-15T00:00:00', '2025-01-15T06:00:00');
    expect(result.startTime).toBeUndefined();
  });

  it('>24h ≤60 days → days (ceil)', () => {
    const result = convertToSimpleDuration('2025-01-01T00:00:00', '2025-01-04T12:00:00');
    expect(result.duration.unit).toBe('days');
    // 3.5 days → ceil = 4
    expect(result.duration.value).toBe(4);
  });

  it('>60 days ≤18 months → months', () => {
    const result = convertToSimpleDuration('2025-01-01T00:00:00', '2025-06-01T00:00:00');
    expect(result.duration.unit).toBe('months');
    // ~151 days / 30 ≈ 5 months
    expect(result.duration.value).toBe(5);
  });

  it('>18 months → years', () => {
    const result = convertToSimpleDuration('2025-01-01T00:00:00', '2027-06-01T00:00:00');
    expect(result.duration.unit).toBe('years');
    expect(result.duration.value).toBeGreaterThanOrEqual(2);
  });

  it('defaults to 1h when no end date', () => {
    const result = convertToSimpleDuration('2025-01-15T14:00:00');
    expect(result.duration.unit).toBe('hours');
    expect(result.duration.value).toBe(1);
    expect(result.startTime).toBe('14:00');
  });

  it('minimum 1 hour for very short durations', () => {
    const result = convertToSimpleDuration('2025-01-15T10:00:00', '2025-01-15T10:05:00');
    expect(result.duration.unit).toBe('hours');
    expect(result.duration.value).toBeGreaterThanOrEqual(1);
  });
});

// ─── computeEventEndDate ───

describe('computeEventEndDate', () => {
  it('adds hours', () => {
    const end = computeEventEndDate('2025-01-15', '10:00', { value: 3, unit: 'hours' });
    expect(end.getHours()).toBe(13);
  });

  it('adds days', () => {
    const end = computeEventEndDate('2025-01-15', undefined, { value: 5, unit: 'days' });
    expect(end.getDate()).toBe(20);
  });

  it('adds months (handles month boundary)', () => {
    const end = computeEventEndDate('2025-01-31', undefined, { value: 1, unit: 'months' });
    // Jan 31 + 1 month → Feb 28 (or Mar depending on JS Date behavior)
    expect(end.getMonth()).toBeGreaterThanOrEqual(1); // at least February
  });

  it('adds years', () => {
    const end = computeEventEndDate('2025-01-15', undefined, { value: 2, unit: 'years' });
    expect(end.getFullYear()).toBe(2027);
  });

  it('handles leap year', () => {
    const end = computeEventEndDate('2024-02-29', undefined, { value: 1, unit: 'years' });
    // 2025 is not leap, so Feb 29 + 1y → Mar 1 2025
    expect(end.getFullYear()).toBe(2025);
  });
});

// ─── countCharacters ───

describe('countCharacters', () => {
  it('counts plain text length', () => {
    expect(countCharacters('Hello world')).toBe(11);
  });

  it('strips HTML tags', () => {
    expect(countCharacters('<p>Hello <strong>world</strong></p>')).toBe(11);
  });

  it('converts &nbsp; to space', () => {
    expect(countCharacters('Hello&nbsp;world')).toBe(11);
  });

  it('returns 0 for empty string', () => {
    expect(countCharacters('')).toBe(0);
  });
});

// ─── countWordsFromHtml ───

describe('countWordsFromHtml', () => {
  it('counts words from plain text', () => {
    expect(countWordsFromHtml('Hello world foo')).toBe(3);
  });

  it('strips HTML and counts words', () => {
    expect(countWordsFromHtml('<p>Hello <strong>world</strong></p>')).toBe(2);
  });

  it('handles <br> tags as word separators', () => {
    expect(countWordsFromHtml('Hello<br>world')).toBe(2);
  });

  it('returns 0 for empty HTML', () => {
    expect(countWordsFromHtml('')).toBe(0);
    expect(countWordsFromHtml('<p></p>')).toBe(0);
  });

  it('handles multiple spaces', () => {
    expect(countWordsFromHtml('Hello   world')).toBe(2);
  });
});

// ─── convertCount ───

describe('convertCount', () => {
  it('words to characters (×6)', () => {
    expect(convertCount(100, 'words', 'characters')).toBe(600);
  });

  it('characters to words (÷6)', () => {
    expect(convertCount(600, 'characters', 'words')).toBe(100);
  });

  it('same unit returns same value', () => {
    expect(convertCount(42, 'words', 'words')).toBe(42);
    expect(convertCount(42, 'characters', 'characters')).toBe(42);
  });

  it('rounds result', () => {
    expect(convertCount(10, 'characters', 'words')).toBe(Math.round(10 / WORDS_TO_CHARS_RATIO));
  });
});

// ─── countFromHtml ───

describe('countFromHtml', () => {
  it('counts words when unit is words', () => {
    expect(countFromHtml('<p>Hello world</p>', 'words')).toBe(2);
  });

  it('counts characters when unit is characters', () => {
    expect(countFromHtml('<p>Hello world</p>', 'characters')).toBe(11);
  });
});

// ─── formatCount ───

describe('formatCount', () => {
  it('formats words', () => {
    expect(formatCount(1500, 'words')).toContain('mots');
  });

  it('formats characters as signes', () => {
    expect(formatCount(9000, 'characters')).toContain('signes');
  });
});

// ─── countUnitLabel ───

describe('countUnitLabel', () => {
  it('returns mots for words', () => {
    expect(countUnitLabel('words')).toBe('mots');
  });

  it('returns signes for characters', () => {
    expect(countUnitLabel('characters')).toBe('signes');
  });
});

// ─── isSpecialChapter ───

describe('isSpecialChapter', () => {
  it('returns true for front_matter', () => {
    expect(isSpecialChapter({ type: 'front_matter' })).toBe(true);
  });

  it('returns true for back_matter', () => {
    expect(isSpecialChapter({ type: 'back_matter' })).toBe(true);
  });

  it('returns false for chapter', () => {
    expect(isSpecialChapter({ type: 'chapter' })).toBe(false);
  });

  it('returns false when type is undefined', () => {
    expect(isSpecialChapter({})).toBe(false);
  });
});

// ─── getChapterLabel ───

describe('getChapterLabel', () => {
  it('returns front matter label', () => {
    expect(getChapterLabel({ type: 'front_matter', number: 0 })).toBe("Avant l'histoire");
  });

  it('returns back matter label', () => {
    expect(getChapterLabel({ type: 'back_matter', number: 99999 })).toBe("Après l'histoire");
  });

  it('returns numbered chapter without title', () => {
    expect(getChapterLabel({ type: 'chapter', number: 3 })).toBe('Chapitre 3');
  });

  it('returns numbered chapter with title', () => {
    expect(getChapterLabel({ type: 'chapter', number: 1, title: 'Le début' })).toBe('Chapitre 1 — Le début');
  });
});

// ─── getChapterShortLabel ───

describe('getChapterShortLabel', () => {
  it('returns front matter label', () => {
    expect(getChapterShortLabel({ type: 'front_matter', number: 0 })).toBe("Avant l'histoire");
  });

  it('returns short form for chapters', () => {
    expect(getChapterShortLabel({ type: 'chapter', number: 5 })).toBe('Ch. 5');
  });

  it('includes title in short form', () => {
    expect(getChapterShortLabel({ type: 'chapter', number: 2, title: 'Test' })).toBe('Ch. 2 — Test');
  });
});

// ─── formatDuration ───

describe('formatDuration', () => {
  it('singular hour', () => {
    expect(formatDuration({ value: 1, unit: 'hours' })).toBe('1 heure');
  });

  it('plural hours', () => {
    expect(formatDuration({ value: 5, unit: 'hours' })).toBe('5 heures');
  });

  it('singular day', () => {
    expect(formatDuration({ value: 1, unit: 'days' })).toBe('1 jour');
  });

  it('plural days', () => {
    expect(formatDuration({ value: 3, unit: 'days' })).toBe('3 jours');
  });

  it('months (invariable)', () => {
    expect(formatDuration({ value: 1, unit: 'months' })).toBe('1 mois');
    expect(formatDuration({ value: 6, unit: 'months' })).toBe('6 mois');
  });

  it('singular year', () => {
    expect(formatDuration({ value: 1, unit: 'years' })).toBe('1 an');
  });

  it('plural years', () => {
    expect(formatDuration({ value: 3, unit: 'years' })).toBe('3 ans');
  });
});

// ─── formatWritingTime ───

describe('formatWritingTime', () => {
  it('formats minutes < 60', () => {
    expect(formatWritingTime(45)).toBe('45 min');
  });

  it('formats exact hours', () => {
    expect(formatWritingTime(120)).toBe('2h');
  });

  it('formats hours with minutes', () => {
    expect(formatWritingTime(90)).toBe('1h30');
  });

  it('pads minutes to 2 digits', () => {
    expect(formatWritingTime(65)).toBe('1h05');
  });

  it('handles 0 minutes', () => {
    expect(formatWritingTime(0)).toBe('0 min');
  });
});
