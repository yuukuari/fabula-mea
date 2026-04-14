/**
 * Extension TipTap de correction hybride + menu contextuel :
 * - **Orthographe** (nspell / Hunspell) : vérification locale, instantanée, hors-ligne.
 *   → Soulignement rouge ondulé.
 * - **Grammaire** (LanguageTool API) : vérification par paragraphe modifié uniquement.
 *   → Soulignement bleu/violet ondulé.
 * - **Menu contextuel** (clic droit) : couper/copier/coller, correction orthographe/grammaire,
 *   outils d'écriture (casse, définition, conjugaison, étymologie, champ lexical, synonymes,
 *   antonymes via CNRTL), recherche Wikipédia/internet. Cmd/Ctrl+clic droit → menu natif.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { initSpellChecker, getSpellChecker, loadCustomWords, addWord, tokenize } from './nspell-instance';

// ── Types ────────────────────────────────────────────────────────
type ErrorType = 'spelling' | 'grammar';

interface SpellError {
  from: number;
  to: number;
  word: string;
  message: string;
  suggestions: string[];
  type: ErrorType;
}

interface LTMatch {
  offset: number;
  length: number;
  message: string;
  replacements: { value: string }[];
  rule: { id: string; category: { id: string } };
}

interface LTResponse {
  matches: LTMatch[];
}

interface PluginState {
  decorationSet: DecorationSet;
  errors: SpellError[];
  ignoredWords: Set<string>;
  paragraphHashes: Map<number, string>;
}

// ── LanguageTool API (grammar only) ─────────────────────────────
const LT_API_URL = 'https://api.languagetool.org/v2/check';

const LT_SKIP_CATEGORIES = new Set(['TYPOS', 'TYPOGRAPHY', 'STYLE', 'CASING', 'COMPOUNDING']);
const LT_SKIP_RULES = new Set(['WHITESPACE_RULE', 'FR_SPELLING_RULE', 'HUNSPELL_RULE', 'MORFOLOGIK_RULE_FR']);

const grammarCache = new Map<string, LTResponse>();

async function checkGrammar(text: string, language: string): Promise<LTResponse> {
  const cached = grammarCache.get(text);
  if (cached) return cached;

  const body = new URLSearchParams({
    text,
    language,
    enabledOnly: 'false',
    disabledCategories: 'TYPOS,TYPOGRAPHY,STYLE,CASING',
  });

  const res = await fetch(LT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`LanguageTool: ${res.status}`);
  const data = (await res.json()) as LTResponse;

  grammarCache.set(text, data);
  if (grammarCache.size > 200) {
    const first = grammarCache.keys().next().value;
    if (first) grammarCache.delete(first);
  }
  return data;
}

// ── CNRTL synonyms/antonyms scraping ────────────────────────────
const cnrtlCache = new Map<string, string[]>();

async function fetchCnrtl(type: 'synonymie' | 'antonymie', word: string): Promise<string[]> {
  const key = `${type}:${word}`;
  const cached = cnrtlCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(`https://www.cnrtl.fr/${type}/${encodeURIComponent(word)}`);
    if (!res.ok) return [];
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const allLinks = doc.querySelectorAll('td a');
    const words = Array.from(allLinks)
      .map((a) => (a as HTMLAnchorElement).textContent?.trim() ?? '')
      .filter((w) => w && !w.includes(',') && w.length > 1 && w.length < 30);
    cnrtlCache.set(key, words);
    if (cnrtlCache.size > 200) {
      const first = cnrtlCache.keys().next().value;
      if (first) cnrtlCache.delete(first);
    }
    return words;
  } catch {
    return [];
  }
}

// ── Context menu / suggestion box ───────────────────────────────
let menuBox: HTMLDivElement | null = null;
let menuOpenedAt = 0; // timestamp to prevent closing immediately after opening

function ensureMenuBox(): HTMLDivElement {
  if (menuBox) return menuBox;
  const box = document.createElement('div');
  box.className = 'spellcheck-context-menu';
  box.style.display = 'none';
  document.body.appendChild(box);
  menuBox = box;
  return box;
}

function hideMenuBox() {
  if (!menuBox) return;
  // Prevent closing the menu within 300ms of opening (right-click release race)
  if (Date.now() - menuOpenedAt < 300) return;
  menuBox.style.display = 'none';
  menuBox.innerHTML = '';
}

function positionMenuBox(rect: DOMRect) {
  const box = ensureMenuBox();
  box.style.display = 'block';
  menuOpenedAt = Date.now();
  const boxRect = box.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 4;

  if (left + boxRect.width > window.innerWidth - 8) {
    left = window.innerWidth - boxRect.width - 8;
  }
  if (top + boxRect.height > window.innerHeight - 8) {
    top = rect.top - boxRect.height - 4;
  }

  box.style.left = `${Math.max(4, left)}px`;
  box.style.top = `${Math.max(4, top)}px`;
}


// ── SVG icon helpers (inline, no import needed) ─────────────────
const ICON_EXTERNAL = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
const ICON_BOOK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>';
const ICON_GLOBE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
const ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
const ICON_SCISSORS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/><path d="m8.12 15.88 12-12"/></svg>';
const ICON_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const ICON_CLIPBOARD = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>';
const ICON_CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
const ICON_BACK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
const ICON_PEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>';
const ICON_REPLACE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4c0-1.1.9-2 2-2"/><path d="M20 2c1.1 0 2 .9 2 2"/><path d="M22 8c0 1.1-.9 2-2 2"/><path d="M16 10c-1.1 0-2-.9-2-2"/><path d="m3 7 3 3 3-3"/><path d="M6 10V5c0-1.7 1.3-3 3-3h1"/><path d="m21 17-3-3-3 3"/><path d="M18 14v5c0 1.7-1.3 3-3 3h-1"/><path d="M2 14c0-1.1.9-2 2-2"/><path d="M8 12c1.1 0 2 .9 2 2"/><path d="M10 18c0 1.1-.9 2-2 2"/><path d="M4 20c-1.1 0-2-.9-2-2"/></svg>';
const ICON_ALERT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';
const ICON_COPY_SM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
// Lucide: Languages (conjugaison)
const ICON_LANGUAGES = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>';
// Lucide: BookOpen (étymologie)
const ICON_BOOK_OPEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
// Lucide: Share2 (champ lexical / réseau de mots)
const ICON_NETWORK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>';
// Lucide: CaseUpper (MAJUSCULES)
const ICON_CASE_UPPER = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 15 4-8 4 8"/><path d="M4 13h6"/><path d="M15 11h4.5a2 2 0 0 1 0 4H15V7h4a2 2 0 0 1 0 4"/></svg>';
// Lucide: CaseLower (minuscules)
const ICON_CASE_LOWER = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="12" r="3"/><path d="M10 9v6"/><circle cx="17" cy="12" r="3"/><path d="M14 7v8"/></svg>';
/** Helper to create a ctx-row button */
function createMenuRow(
  icon: string,
  label: string,
  rightIcon: string | null,
  handler: (e: MouseEvent) => void
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'ctx-row';
  btn.innerHTML = `<span class="ctx-row-left">${icon}<span>${label}</span></span>${rightIcon ? `<span class="ctx-row-right">${rightIcon}</span>` : ''}`;
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handler(e);
  });
  return btn;
}

/** Show the main context menu view inside box */
function renderMainMenu(
  box: HTMLDivElement,
  rect: DOMRect,
  word: string | null,
  wordFrom: number,
  wordTo: number,
  selFrom: number,
  selTo: number,
  error: SpellError | null,
  callbacks: {
    replace: (from: number, to: number, text: string) => void;
    cut: () => void;
    copy: () => void;
    paste: () => void;
    ignore?: () => void;
    ignoreAll?: () => void;
    addToDictionary?: () => void;
    toUpperCase: () => void;
    toLowerCase: () => void;
  },
  selectedText: string
) {
  box.innerHTML = '';

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const nativeHintKey = isMac ? '⌘' : 'Ctrl';

  // ── Section 1: Cut / Copy / Paste ──
  box.appendChild(createMenuRow(ICON_SCISSORS, 'Couper', null, () => { callbacks.cut(); hideMenuBox(); }));
  box.appendChild(createMenuRow(ICON_COPY, 'Copier', null, () => { callbacks.copy(); hideMenuBox(); }));
  box.appendChild(createMenuRow(ICON_CLIPBOARD, 'Coller', null, () => { callbacks.paste(); hideMenuBox(); }));

  // If multi-word selection (no single word context)
  if (!word) {
    const multiParams: MenuParams = { box, rect, word: '', wordFrom: selFrom, wordTo: selTo, selFrom, selTo, error: null, callbacks, selectedText };

    // ── Writing tools (case transforms) → submenu ──
    const sepTools = document.createElement('div');
    sepTools.className = 'ctx-separator';
    box.appendChild(sepTools);
    box.appendChild(createMenuRow(ICON_PEN, 'Outils d\u2019écriture', ICON_CHEVRON, () => {
      menuOpenedAt = Date.now();
      renderToolsSubmenu(multiParams);
    }));

    // ── Search ──
    if (selectedText.trim()) {
      const sepSearch = document.createElement('div');
      sepSearch.className = 'ctx-separator';
      box.appendChild(sepSearch);
      box.appendChild(createLinkRow(ICON_GLOBE, 'Rechercher sur internet', `https://www.google.com/search?q=${encodeURIComponent(selectedText.trim())}`));
    }

    // ── Native menu hint ──
    const hint = document.createElement('div');
    hint.className = 'ctx-hint';
    hint.textContent = `${nativeHintKey} + clic droit pour le menu natif`;
    box.appendChild(hint);

    positionMenuBox(rect);
    return;
  }

  // Store all params needed to re-render main menu (for back navigation)
  const mainMenuParams: MenuParams = { box, rect, word, wordFrom, wordTo, selFrom, selTo, error, callbacks, selectedText };

  // ── Section 2: Correction → submenu (if error detected) ──
  if (error) {
    const sep1 = document.createElement('div');
    sep1.className = 'ctx-separator';
    box.appendChild(sep1);

    const errorLabel = error.type === 'spelling' ? 'Orthographe' : 'Grammaire';
    const errorRow = createMenuRow(ICON_ALERT, `Correction (${errorLabel})`, ICON_CHEVRON, () => {
      menuOpenedAt = Date.now();
      renderCorrectionSubmenu(mainMenuParams);
    });
    errorRow.classList.add(error.type === 'spelling' ? 'ctx-row-error-spelling' : 'ctx-row-error-grammar');
    box.appendChild(errorRow);
  }

  // ── Section 3: Writing tools → submenu ──
  const sep2 = document.createElement('div');
  sep2.className = 'ctx-separator';
  box.appendChild(sep2);

  box.appendChild(createMenuRow(ICON_PEN, 'Outils d\u2019écriture', ICON_CHEVRON, () => {
    menuOpenedAt = Date.now();
    renderToolsSubmenu(mainMenuParams);
  }));

  // ── Section 4: Search links ──
  const sep3 = document.createElement('div');
  sep3.className = 'ctx-separator';
  box.appendChild(sep3);

  box.appendChild(createLinkRow(ICON_GLOBE, 'Rechercher sur Wikipédia', `https://fr.wikipedia.org/wiki/${encodeURIComponent(word)}`));
  box.appendChild(createLinkRow(ICON_GLOBE, 'Rechercher sur internet', `https://www.google.com/search?q=${encodeURIComponent(word.toLowerCase())}`));

  // ── Hint: native menu shortcut ──
  const hint = document.createElement('div');
  hint.className = 'ctx-hint';
  hint.textContent = `${nativeHintKey} + clic droit pour le menu natif`;
  box.appendChild(hint);

  positionMenuBox(rect);
}

/** Params bundle for navigating back to main menu */
interface MenuParams {
  box: HTMLDivElement;
  rect: DOMRect;
  word: string;
  wordFrom: number;
  wordTo: number;
  selFrom: number;
  selTo: number;
  error: SpellError | null;
  callbacks: {
    replace: (from: number, to: number, text: string) => void;
    cut: () => void;
    copy: () => void;
    paste: () => void;
    ignore?: () => void;
    ignoreAll?: () => void;
    addToDictionary?: () => void;
    toUpperCase: () => void;
    toLowerCase: () => void;
  };
  /** Selected text (for internet search on multi-word selections) */
  selectedText: string;
}

/** Helper to create an external link row */
function createLinkRow(icon: string, label: string, url: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'ctx-row';
  link.setAttribute('href', url);
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener');
  link.innerHTML = `<span class="ctx-row-left">${icon}<span>${label}</span></span><span class="ctx-row-right">${ICON_EXTERNAL}</span>`;
  link.addEventListener('click', () => { setTimeout(hideMenuBox, 50); });
  return link;
}

/** Show the correction submenu (spelling/grammar) */
function renderCorrectionSubmenu(params: MenuParams) {
  const { box, rect, error, callbacks } = params;
  if (!error) return;
  box.innerHTML = '';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'ctx-row ctx-back-row';
  const label = error.type === 'spelling' ? 'Orthographe' : 'Grammaire';
  backBtn.innerHTML = `<span class="ctx-row-left">${ICON_BACK}<span>${label}</span></span>`;
  backBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menuOpenedAt = Date.now();
    renderMainMenu(params.box, params.rect, params.word, params.wordFrom, params.wordTo, params.selFrom, params.selTo, params.error, params.callbacks, params.selectedText);
  });
  box.appendChild(backBtn);

  const sep = document.createElement('div');
  sep.className = 'ctx-separator';
  box.appendChild(sep);

  // Error message
  const msgEl = document.createElement('div');
  msgEl.className = 'suggestion-message';
  msgEl.textContent = error.message;
  box.appendChild(msgEl);

  // Suggestions
  if (error.suggestions.length > 0) {
    const sugSep = document.createElement('div');
    sugSep.className = 'ctx-separator';
    box.appendChild(sugSep);

    for (const sug of error.suggestions.slice(0, 5)) {
      const item = document.createElement('button');
      item.className = 'suggestion-item';
      item.textContent = sug;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        callbacks.replace(error.from, error.to, sug);
        hideMenuBox();
      });
      box.appendChild(item);
    }
  }

  // Actions
  const actionSep = document.createElement('div');
  actionSep.className = 'ctx-separator';
  box.appendChild(actionSep);

  if (callbacks.ignore) {
    box.appendChild(createMenuRow('', 'Ignorer', null, () => { callbacks.ignore!(); hideMenuBox(); }));
  }

  if (error.type === 'spelling' && callbacks.ignoreAll) {
    box.appendChild(createMenuRow('', 'Ignorer tout', null, () => { callbacks.ignoreAll!(); hideMenuBox(); }));
  }

  if (error.type === 'spelling' && callbacks.addToDictionary) {
    const addBtn = createMenuRow('', 'Ajouter au dictionnaire', null, () => { callbacks.addToDictionary!(); hideMenuBox(); });
    addBtn.classList.add('ctx-row-accent');
    box.appendChild(addBtn);
  }

  positionMenuBox(rect);
}

/** Show the writing tools submenu */
function renderToolsSubmenu(params: MenuParams) {
  const { box, rect, word, callbacks } = params;
  const isMultiWord = !word || word === '';
  box.innerHTML = '';

  // Back button → re-render main menu
  const backBtn = document.createElement('button');
  backBtn.className = 'ctx-row ctx-back-row';
  backBtn.innerHTML = `<span class="ctx-row-left">${ICON_BACK}<span>Outils d\u2019écriture</span></span>`;
  backBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menuOpenedAt = Date.now();
    renderMainMenu(params.box, params.rect, isMultiWord ? null : params.word, params.wordFrom, params.wordTo, params.selFrom, params.selTo, params.error, params.callbacks, params.selectedText);
  });
  box.appendChild(backBtn);

  const sep = document.createElement('div');
  sep.className = 'ctx-separator';
  box.appendChild(sep);

  // ── Case transforms (always available) ──
  box.appendChild(createMenuRow(ICON_CASE_UPPER, 'MAJUSCULES', null, () => { callbacks.toUpperCase(); hideMenuBox(); }));
  box.appendChild(createMenuRow(ICON_CASE_LOWER, 'minuscules', null, () => { callbacks.toLowerCase(); hideMenuBox(); }));

  // ── Word-specific tools (only for single word) ──
  if (!isMultiWord) {
    const encoded = encodeURIComponent(word.toLowerCase());

    const sep2 = document.createElement('div');
    sep2.className = 'ctx-separator';
    box.appendChild(sep2);

    // ── Lookup links ──
    box.appendChild(createLinkRow(ICON_BOOK, 'Définition', `https://www.cnrtl.fr/definition/${encoded}`));
    box.appendChild(createLinkRow(ICON_LANGUAGES, 'Conjugaison', `https://www.cnrtl.fr/morphologie/${encoded}`));
    box.appendChild(createLinkRow(ICON_BOOK_OPEN, 'Étymologie', `https://www.cnrtl.fr/etymologie/${encoded}`));
    box.appendChild(createLinkRow(ICON_NETWORK, 'Champ lexical', `https://www.cnrtl.fr/proxemie/${encoded}`));

    const sep3 = document.createElement('div');
    sep3.className = 'ctx-separator';
    box.appendChild(sep3);

    // ── Synonyms / Antonyms (with inline results) ──
    box.appendChild(createMenuRow(ICON_SEARCH, 'Trouver des synonymes', ICON_CHEVRON, () => {
      renderCnrtlResults(params, 'synonymie');
    }));
    box.appendChild(createMenuRow(ICON_SEARCH, 'Trouver des antonymes', ICON_CHEVRON, () => {
      renderCnrtlResults(params, 'antonymie');
    }));
  }

  positionMenuBox(rect);
}

/** Show synonym/antonym results submenu */
function renderCnrtlResults(
  params: MenuParams,
  type: 'synonymie' | 'antonymie',
) {
  const { box, rect, word, wordFrom, wordTo, callbacks } = params;
  const title = type === 'synonymie' ? 'Synonymes' : 'Antonymes';
  box.innerHTML = '';

  // Back button → go back to tools submenu
  const backBtn = document.createElement('button');
  backBtn.className = 'ctx-row ctx-back-row';
  backBtn.innerHTML = `<span class="ctx-row-left">${ICON_BACK}<span>${title}</span></span>`;
  backBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menuOpenedAt = Date.now();
    renderToolsSubmenu(params);
  });
  box.appendChild(backBtn);

  const sep = document.createElement('div');
  sep.className = 'ctx-separator';
  box.appendChild(sep);

  // Loading
  const loading = document.createElement('div');
  loading.className = 'ctx-loading';
  loading.textContent = 'Chargement…';
  box.appendChild(loading);
  positionMenuBox(rect);

  fetchCnrtl(type, word.toLowerCase()).then((results) => {
    loading.remove();

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ctx-empty';
      empty.textContent = type === 'synonymie' ? 'Aucun synonyme trouvé' : 'Aucun antonyme trouvé';
      box.appendChild(empty);
    } else {
      for (const w of results.slice(0, 6)) {
        const row = document.createElement('div');
        row.className = 'ctx-result-row';

        const label = document.createElement('span');
        label.className = 'ctx-result-label';
        label.textContent = w;
        row.appendChild(label);

        const actions = document.createElement('span');
        actions.className = 'ctx-result-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'ctx-result-btn';
        copyBtn.title = 'Copier';
        copyBtn.innerHTML = ICON_COPY_SM;
        copyBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(w);
          copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
          setTimeout(() => { copyBtn.innerHTML = ICON_COPY_SM; }, 1200);
        });
        actions.appendChild(copyBtn);

        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'ctx-result-btn';
        replaceBtn.title = 'Remplacer';
        replaceBtn.innerHTML = ICON_REPLACE;
        replaceBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          callbacks.replace(wordFrom, wordTo, w);
          hideMenuBox();
        });
        actions.appendChild(replaceBtn);

        row.appendChild(actions);
        box.appendChild(row);
      }
    }

    // "Voir tout" link — always visible
    const viewAll = document.createElement('a');
    viewAll.className = 'ctx-row ctx-row-muted';
    viewAll.setAttribute('href', `https://www.cnrtl.fr/${type}/${encodeURIComponent(word.toLowerCase())}`);
    viewAll.setAttribute('target', '_blank');
    viewAll.setAttribute('rel', 'noopener');
    viewAll.innerHTML = `<span class="ctx-row-left"><span>Voir tous les ${type === 'synonymie' ? 'synonymes' : 'antonymes'}</span></span><span class="ctx-row-right">${ICON_EXTERNAL}</span>`;
    viewAll.addEventListener('click', () => { setTimeout(hideMenuBox, 50); });
    box.appendChild(viewAll);

    positionMenuBox(rect);
  });
}

// ── Helpers ──────────────────────────────────────────────────────
function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as unknown as T & { cancel: () => void };
  debounced.cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  return debounced;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

function getParagraphs(doc: Parameters<typeof DecorationSet.create>[0]) {
  const paragraphs: { from: number; to: number; text: string; hash: string }[] = [];
  doc.descendants((node: { isBlock: boolean; isTextblock: boolean; textContent: string; nodeSize: number; content: { forEach: (fn: (child: { isText: boolean; text?: string | null; type: { name: string } }, offset: number) => void) => void; size: number } }, pos: number) => {
    if (node.isTextblock) {
      // Build text manually to handle hardBreak nodes as newlines
      let text = '';
      node.content.forEach((child) => {
        if (child.isText && child.text) {
          text += child.text;
        } else if (child.type.name === 'hardBreak') {
          text += '\n';
        }
      });
      if (text.trim()) {
        paragraphs.push({ from: pos, to: pos + node.nodeSize, text, hash: simpleHash(text) });
      }
      return false;
    }
    return true;
  });
  return paragraphs;
}

/**
 * Extract the word at a given ProseMirror position.
 * Returns { word, from, to } or null.
 */
function getWordAtPos(view: EditorView, pos: number): { word: string; from: number; to: number } | null {
  const { doc } = view.state;
  const $pos = doc.resolve(pos);
  const textNode = $pos.parent;
  if (!textNode.isTextblock) return null;

  const textContent = textNode.textContent;
  const offset = pos - $pos.start();

  // Find word boundaries
  const wordChars = /[a-zA-ZÀ-ÿ'\u2019-]/;
  let start = offset;
  let end = offset;

  while (start > 0 && wordChars.test(textContent[start - 1])) start--;
  while (end < textContent.length && wordChars.test(textContent[end])) end++;

  const word = textContent.slice(start, end).replace(/[-'']+$/, '');
  if (word.length === 0) return null;

  const pmFrom = $pos.start() + start;
  const pmTo = pmFrom + word.length;
  return { word, from: pmFrom, to: pmTo };
}

// ── Plugin key ───────────────────────────────────────────────────
const spellcheckPluginKey = new PluginKey('hybrid-spellcheck');

// ── Extension ────────────────────────────────────────────────────
export interface SpellCheckOptions {
  language: string;
  spellingDebounceMs: number;
  grammarDebounceMs: number;
  getCustomWords: () => string[];
  onAddToDictionary?: (word: string) => void;
}

export const SpellCheckExtension = Extension.create<SpellCheckOptions>({
  name: 'hybridSpellcheck',

  addOptions() {
    return {
      language: 'fr',
      spellingDebounceMs: 300,
      grammarDebounceMs: 1500,
      getCustomWords: () => [],
      onAddToDictionary: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { language, spellingDebounceMs, grammarDebounceMs, getCustomWords, onAddToDictionary } =
      this.options;

    return [
      new Plugin({
        key: spellcheckPluginKey,

        state: {
          init(): PluginState {
            return {
              decorationSet: DecorationSet.empty,
              errors: [],
              ignoredWords: new Set(),
              paragraphHashes: new Map(),
            };
          },
          apply(tr, value: PluginState): PluginState {
            const meta = tr.getMeta(spellcheckPluginKey);
            if (meta) return { ...value, ...meta };
            if (tr.docChanged) {
              return {
                ...value,
                decorationSet: value.decorationSet.map(tr.mapping, tr.doc),
              };
            }
            return value;
          },
        },

        props: {
          decorations(state) {
            return spellcheckPluginKey.getState(state)?.decorationSet ?? DecorationSet.empty;
          },

          handleClick() {
            // Left-click hides context menu if open
            hideMenuBox();
            return false;
          },

          handleDOMEvents: {
            contextmenu(view: EditorView, event: Event) {
              const mouseEvent = event as MouseEvent;
              const pos = view.posAtCoords({ left: mouseEvent.clientX, top: mouseEvent.clientY });
              if (!pos) return false;

              const pluginState = spellcheckPluginKey.getState(view.state) as PluginState | undefined;
              if (!pluginState) return false;

              // Cmd+right-click (Mac) or Ctrl+right-click (PC) → native browser menu
              if (mouseEvent.metaKey || mouseEvent.ctrlKey) return false;

              mouseEvent.preventDefault();
              openContextMenuAtPos(view, pos.pos, pluginState);
              return true;
            },
          },
        },

        view(editorView: EditorView) {
          ensureMenuBox();
          let nspellReady = false;
          let lastCustomWordsKey = '';

          const handleDocMousedown = (e: MouseEvent) => {
            const box = ensureMenuBox();
            if (!box.contains(e.target as Node)) hideMenuBox();
          };
          document.addEventListener('mousedown', handleDocMousedown);

          // Hide menu on keydown (user starts typing)
          const handleEditorKeydown = () => { hideMenuBox(); };
          editorView.dom.addEventListener('keydown', handleEditorKeydown);

          // ── Init nspell ──
          initSpellChecker()
            .then(() => {
              nspellReady = true;
              const words = getCustomWords();
              loadCustomWords(words);
              lastCustomWordsKey = words.join(',');
              runSpellingCheck();
            })
            .catch((err) => console.warn('[SpellCheck] Failed to load dictionary:', err));

          // ── Spelling check (nspell, local, per paragraph) ──
          function runSpellingCheck() {
            if (!nspellReady) return;
            const checker = getSpellChecker();
            if (!checker) return;

            const currentWords = getCustomWords();
            const currentKey = currentWords.join(',');
            if (currentKey !== lastCustomWordsKey) {
              loadCustomWords(currentWords);
              lastCustomWordsKey = currentKey;
            }

            const { doc } = editorView.state;
            if (!doc.textContent.trim()) {
              dispatch({ errors: [], decorationSet: DecorationSet.empty });
              return;
            }

            const pluginState = spellcheckPluginKey.getState(editorView.state) as PluginState;
            const ignoredWords = pluginState.ignoredWords;
            const spellingErrors: SpellError[] = [];
            const decorations: Decoration[] = [];

            // Check per paragraph to handle line breaks correctly
            doc.descendants((node: { isTextblock: boolean; content: { forEach: (fn: (child: { isText: boolean; text?: string | null; type: { name: string } }, offset: number) => void) => void } }, pos: number) => {
              if (!node.isTextblock) return true;

              // Build text with offsets, inserting spaces for hardBreak nodes
              let text = '';
              const offsets: number[] = [];
              node.content.forEach((child, offset) => {
                if (child.isText && child.text) {
                  const base = pos + 1 + offset;
                  for (let i = 0; i < child.text.length; i++) {
                    offsets.push(base + i);
                    text += child.text[i];
                  }
                } else if (child.type.name === 'hardBreak') {
                  offsets.push(-1);
                  text += ' ';
                }
              });

              if (!text.trim()) return false;

              const tokens = tokenize(text);
              for (const token of tokens) {
                const { word, offset: tokenOffset } = token;
                const lowerWord = word.toLowerCase();
                if (ignoredWords.has(lowerWord)) continue;
                if (checker.correct(word) || checker.correct(lowerWord) || checker.correct(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())) continue;

                const fromIdx = tokenOffset;
                const toIdx = tokenOffset + word.length - 1;
                if (fromIdx >= offsets.length || toIdx >= offsets.length) continue;
                if (offsets[fromIdx] === -1 || offsets[toIdx] === -1) continue;

                const pmFrom = offsets[fromIdx];
                const pmTo = offsets[toIdx] + 1;

                spellingErrors.push({
                  from: pmFrom,
                  to: pmTo,
                  word,
                  message: `« ${word} » ne figure pas dans le dictionnaire`,
                  suggestions: [], // computed lazily on click for performance
                  type: 'spelling',
                });
                decorations.push(
                  Decoration.inline(pmFrom, pmTo, { class: 'spellcheck-spelling', nodeName: 'span' })
                );
              }
              return false;
            });

            const existingState = spellcheckPluginKey.getState(editorView.state) as PluginState;
            const grammarErrors = existingState.errors.filter((e) => e.type === 'grammar');
            const grammarDecos = grammarErrors.map((e) =>
              Decoration.inline(e.from, e.to, { class: 'spellcheck-grammar', nodeName: 'span' })
            );

            dispatch({
              errors: [...spellingErrors, ...grammarErrors],
              decorationSet: DecorationSet.create(doc, [...decorations, ...grammarDecos]),
            });
          }

          // ── Grammar check (LanguageTool, per paragraph) ──
          async function runGrammarCheck() {
            const { doc } = editorView.state;
            const paragraphs = getParagraphs(doc);
            if (paragraphs.length === 0) return;

            const pluginState = spellcheckPluginKey.getState(editorView.state) as PluginState;
            const oldHashes = pluginState.paragraphHashes;
            const newHashes = new Map<number, string>();
            const changedParagraphs: typeof paragraphs = [];

            for (const p of paragraphs) {
              newHashes.set(p.from, p.hash);
              if (oldHashes.get(p.from) !== p.hash) {
                changedParagraphs.push(p);
              }
            }

            if (changedParagraphs.length === 0) return;

            try {
              const grammarErrors: SpellError[] = [];

              const existingGrammar = pluginState.errors.filter((e) => e.type === 'grammar');
              for (const e of existingGrammar) {
                const isInChanged = changedParagraphs.some((p) => e.from >= p.from && e.to <= p.from + p.text.length + 1);
                if (!isInChanged) grammarErrors.push(e);
              }

              for (const para of changedParagraphs) {
                const data = await checkGrammar(para.text, language);

                for (const match of data.matches) {
                  if (LT_SKIP_CATEGORIES.has(match.rule.category.id)) continue;
                  if (LT_SKIP_RULES.has(match.rule.id)) continue;

                  const pmFrom = para.from + 1 + match.offset;
                  const pmTo = pmFrom + match.length;

                  const currentState = spellcheckPluginKey.getState(editorView.state) as PluginState;
                  const overlapsSpelling = currentState.errors.some(
                    (e) => e.type === 'spelling' && pmFrom < e.to && pmTo > e.from
                  );
                  if (overlapsSpelling) continue;

                  grammarErrors.push({
                    from: pmFrom,
                    to: pmTo,
                    word: para.text.slice(match.offset, match.offset + match.length),
                    message: match.message,
                    suggestions: match.replacements.slice(0, 5).map((r) => r.value),
                    type: 'grammar',
                  });
                }
              }

              if (!editorView.state.doc.eq(doc)) return;

              const spellingErrors = (spellcheckPluginKey.getState(editorView.state) as PluginState).errors.filter(
                (e) => e.type === 'spelling'
              );
              const allErrors = [...spellingErrors, ...grammarErrors];
              const allDecos = allErrors.map((e) =>
                Decoration.inline(e.from, e.to, {
                  class: e.type === 'spelling' ? 'spellcheck-spelling' : 'spellcheck-grammar',
                  nodeName: 'span',
                })
              );

              dispatch({
                errors: allErrors,
                decorationSet: DecorationSet.create(doc, allDecos),
                paragraphHashes: newHashes,
              });
            } catch (err) {
              console.warn('[SpellCheck] LanguageTool error:', err);
              dispatch({ paragraphHashes: newHashes });
            }
          }

          function dispatch(partial: Partial<PluginState>) {
            const tr = editorView.state.tr.setMeta(spellcheckPluginKey, partial);
            editorView.dispatch(tr);
          }

          const debouncedSpelling = debounce(runSpellingCheck as (...args: never[]) => void, spellingDebounceMs);
          const debouncedGrammar = debounce(runGrammarCheck as (...args: never[]) => void, grammarDebounceMs);

          debouncedSpelling();
          debouncedGrammar();

          let lastDoc = editorView.state.doc;

          return {
            update() {
              // Only re-schedule checks if the document content actually changed
              // (not just decoration/meta updates from spelling/grammar dispatches)
              const currentDoc = editorView.state.doc;
              if (currentDoc.eq(lastDoc)) return;
              lastDoc = currentDoc;
              debouncedSpelling();
              debouncedGrammar();
            },
            destroy() {
              debouncedSpelling.cancel();
              debouncedGrammar.cancel();
              document.removeEventListener('mousedown', handleDocMousedown);
              editorView.dom.removeEventListener('keydown', handleEditorKeydown);
              hideMenuBox();
            },
          };
        },
      }),
    ];

    function openContextMenuAtPos(view: EditorView, pos: number, pluginState: PluginState) {
      const box = ensureMenuBox();
      const { from: selFrom, to: selTo } = view.state.selection;
      const selLength = selTo - selFrom;

      // Determine if this is a single-word context or multi-word selection
      const wordInfo = getWordAtPos(view, pos);
      const isMultiWord = selLength > 0 && (!wordInfo || selFrom !== wordInfo.from || selTo !== wordInfo.to);

      // For single word: find error and compute suggestions lazily
      let error: SpellError | null = null;
      if (wordInfo && !isMultiWord) {
        error = pluginState.errors.find((e) => pos >= e.from && pos < e.to) ?? null;
        if (error && error.type === 'spelling' && error.suggestions.length === 0) {
          const checker = getSpellChecker();
          if (checker) {
            error = { ...error, suggestions: checker.suggest(error.word).slice(0, 7) };
          }
        }
      }

      // Compute rect for positioning
      const anchorPos = wordInfo && !isMultiWord ? wordInfo.from : selFrom;
      const anchorEnd = wordInfo && !isMultiWord ? wordInfo.to : selTo;
      const coords = view.coordsAtPos(anchorPos);
      const coordsEnd = view.coordsAtPos(anchorEnd);
      const rect = new DOMRect(
        coords.left,
        coords.top,
        coordsEnd.right - coords.left,
        coords.bottom - coords.top
      );

      const wFrom = wordInfo ? wordInfo.from : selFrom;
      const wTo = wordInfo ? wordInfo.to : selTo;

      const callbacks = {
        replace(from: number, to: number, text: string) {
          const tr = view.state.tr.replaceWith(from, to, view.state.schema.text(text));
          view.dispatch(tr);
        },
        cut() {
          // Copy selection to clipboard and delete
          const { from, to } = view.state.selection;
          const text = view.state.doc.textBetween(from, to, '\n');
          navigator.clipboard.writeText(text);
          view.dispatch(view.state.tr.deleteRange(from, to));
        },
        copy() {
          const { from, to } = view.state.selection;
          if (from === to && wordInfo) {
            // No selection — copy the word under cursor
            const text = view.state.doc.textBetween(wordInfo.from, wordInfo.to);
            navigator.clipboard.writeText(text);
          } else {
            const text = view.state.doc.textBetween(from, to, '\n');
            navigator.clipboard.writeText(text);
          }
        },
        async paste() {
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              const { from, to } = view.state.selection;
              view.dispatch(view.state.tr.replaceWith(from, to, view.state.schema.text(text)));
            }
          } catch { /* clipboard permission denied */ }
        },
        ignore: error
          ? () => {
              const current = spellcheckPluginKey.getState(view.state) as PluginState;
              const errors = current.errors.filter((e) => !(e.from === error!.from && e.to === error!.to));
              const decos = errors.map((e) =>
                Decoration.inline(e.from, e.to, {
                  class: e.type === 'spelling' ? 'spellcheck-spelling' : 'spellcheck-grammar',
                  nodeName: 'span',
                })
              );
              view.dispatch(view.state.tr.setMeta(spellcheckPluginKey, {
                errors,
                decorationSet: DecorationSet.create(view.state.doc, decos),
              }));
            }
          : undefined,
        ignoreAll: error?.type === 'spelling'
          ? () => {
              const w = error!.word.toLowerCase();
              const current = spellcheckPluginKey.getState(view.state) as PluginState;
              const newIgnored = new Set(current.ignoredWords);
              newIgnored.add(w);
              const errors = current.errors.filter((e) => e.word.toLowerCase() !== w);
              const decos = errors.map((e) =>
                Decoration.inline(e.from, e.to, {
                  class: e.type === 'spelling' ? 'spellcheck-spelling' : 'spellcheck-grammar',
                  nodeName: 'span',
                })
              );
              view.dispatch(view.state.tr.setMeta(spellcheckPluginKey, {
                errors,
                decorationSet: DecorationSet.create(view.state.doc, decos),
                ignoredWords: newIgnored,
              }));
            }
          : undefined,
        addToDictionary: error?.type === 'spelling' && onAddToDictionary
          ? () => {
              addWord(error!.word);
              onAddToDictionary(error!.word);
              const w = error!.word.toLowerCase();
              const current = spellcheckPluginKey.getState(view.state) as PluginState;
              const errors = current.errors.filter((e) => e.word.toLowerCase() !== w);
              const decos = errors.map((e) =>
                Decoration.inline(e.from, e.to, {
                  class: e.type === 'spelling' ? 'spellcheck-spelling' : 'spellcheck-grammar',
                  nodeName: 'span',
                })
              );
              view.dispatch(view.state.tr.setMeta(spellcheckPluginKey, {
                errors,
                decorationSet: DecorationSet.create(view.state.doc, decos),
              }));
            }
          : undefined,
        toUpperCase() {
          const { from, to } = view.state.selection;
          const f = from === to && wordInfo ? wordInfo.from : from;
          const t = from === to && wordInfo ? wordInfo.to : to;
          const text = view.state.doc.textBetween(f, t);
          view.dispatch(view.state.tr.replaceWith(f, t, view.state.schema.text(text.toUpperCase())));
        },
        toLowerCase() {
          const { from, to } = view.state.selection;
          const f = from === to && wordInfo ? wordInfo.from : from;
          const t = from === to && wordInfo ? wordInfo.to : to;
          const text = view.state.doc.textBetween(f, t);
          view.dispatch(view.state.tr.replaceWith(f, t, view.state.schema.text(text.toLowerCase())));
        },
      };

      // Get selected text for internet search
      const selectedText = isMultiWord
        ? view.state.doc.textBetween(selFrom, selTo, ' ')
        : (wordInfo?.word ?? '');

      renderMainMenu(
        box, rect,
        isMultiWord ? null : (wordInfo?.word ?? null),
        wFrom, wTo, selFrom, selTo,
        error, callbacks, selectedText
      );
    }
  },
});
