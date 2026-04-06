import { describe, it, expect } from 'vitest';
import { escapeXml, cleanHtml } from '@/lib/export-shared';

// ─── escapeXml ───

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes less-than', () => {
    expect(escapeXml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeXml("it's")).toBe('it&apos;s');
  });

  it('escapes all special chars in combination', () => {
    expect(escapeXml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });

  it('returns empty string unchanged', () => {
    expect(escapeXml('')).toBe('');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeXml('Hello world 123')).toBe('Hello world 123');
  });
});

// ─── cleanHtml ───

describe('cleanHtml', () => {
  it('returns <p></p> for empty input', () => {
    expect(cleanHtml('')).toBe('<p></p>');
  });

  it('closes self-closing <br> tags', () => {
    expect(cleanHtml('<p>Hello<br>world</p>')).toBe('<p>Hello<br/>world</p>');
  });

  it('closes self-closing <hr> tags', () => {
    expect(cleanHtml('<hr>')).toBe('<hr/>');
  });

  it('closes self-closing <img> tags', () => {
    expect(cleanHtml('<img src="test.png">')).toBe('<img src="test.png"/>');
  });

  it('removes class attributes', () => {
    expect(cleanHtml('<p class="editor-class">text</p>')).toBe('<p>text</p>');
  });

  it('removes data-* attributes', () => {
    expect(cleanHtml('<span data-node-type="text">hello</span>')).toBe('<span>hello</span>');
  });

  it('removes empty spans', () => {
    expect(cleanHtml('<span> </span>')).toBe('');
  });

  it('converts &nbsp; to numeric entity', () => {
    expect(cleanHtml('Hello&nbsp;world')).toBe('Hello&#160;world');
  });

  it('converts &mdash; to numeric entity', () => {
    expect(cleanHtml('text&mdash;more')).toBe('text&#8212;more');
  });

  it('converts &ndash; to numeric entity', () => {
    expect(cleanHtml('1&ndash;10')).toBe('1&#8211;10');
  });

  it('converts &laquo; and &raquo; to numeric entities', () => {
    expect(cleanHtml('&laquo;Bonjour&raquo;')).toBe('&#171;Bonjour&#187;');
  });

  it('converts &hellip; to numeric entity', () => {
    expect(cleanHtml('Wait&hellip;')).toBe('Wait&#8230;');
  });

  it('normalizes text-align styles', () => {
    expect(cleanHtml('<p style="text-align:center">text</p>')).toBe('<p style="text-align: center">text</p>');
  });

  it('handles combined transformations', () => {
    const input = '<p class="tiptap" data-id="x">Hello<br>&nbsp;&mdash;</p>';
    const result = cleanHtml(input);
    expect(result).not.toContain('class=');
    expect(result).not.toContain('data-');
    expect(result).toContain('<br/>');
    expect(result).toContain('&#160;');
    expect(result).toContain('&#8212;');
  });
});
