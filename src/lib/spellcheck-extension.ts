/**
 * Extension TipTap de correction orthographique via LanguageTool API.
 *
 * Utilise uniquement @tiptap/core et @tiptap/pm pour éviter tout conflit
 * de versions ProseMirror (contrairement aux packages tiers CJS).
 *
 * Fonctionnement :
 * - Debounce les changements de texte (800ms)
 * - Envoie le texte à LanguageTool
 * - Affiche les erreurs en soulignement rouge ondulé (décorations ProseMirror)
 * - Au clic sur une erreur, affiche une boîte de suggestions
 * - Cliquer sur une suggestion remplace le mot erroné
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

// ── Types ────────────────────────────────────────────────────────
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

interface SpellError {
  from: number;
  to: number;
  word: string;
  message: string;
  suggestions: string[];
}

// ── LanguageTool API ─────────────────────────────────────────────
const API_URL = 'https://api.languagetool.org/v2/check';

const responseCache = new Map<string, LTResponse>();
const pendingRequests = new Map<string, Promise<LTResponse>>();

async function checkText(text: string, language: string): Promise<LTResponse> {
  const key = `${language}:${text}`;
  const cached = responseCache.get(key);
  if (cached) return cached;

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const body = new URLSearchParams({ text, language, enabledOnly: 'false' });
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`LanguageTool: ${res.status}`);
    return res.json() as Promise<LTResponse>;
  })();

  pendingRequests.set(key, promise);
  try {
    const result = await promise;
    responseCache.set(key, result);
    if (responseCache.size > 500) {
      const first = responseCache.keys().next().value;
      if (first) responseCache.delete(first);
    }
    return result;
  } finally {
    pendingRequests.delete(key);
  }
}

// ── Suggestion box ───────────────────────────────────────────────
let suggestionBox: HTMLDivElement | null = null;

function ensureSuggestionBox(): HTMLDivElement {
  if (suggestionBox) return suggestionBox;
  const box = document.createElement('div');
  box.className = 'spellchecker-suggestion-box';
  box.style.display = 'none';
  document.body.appendChild(box);
  suggestionBox = box;
  return box;
}

function hideSuggestionBox() {
  if (!suggestionBox) return;
  suggestionBox.style.display = 'none';
  suggestionBox.innerHTML = '';
}

function showSuggestionBox(
  error: SpellError,
  rect: DOMRect,
  replaceCallback: (from: number, to: number, text: string) => void
) {
  const box = ensureSuggestionBox();
  box.innerHTML = '';

  // Message d'erreur
  const msgEl = document.createElement('div');
  msgEl.className = 'suggestion-message';
  msgEl.textContent = error.message;
  box.appendChild(msgEl);

  if (error.suggestions.length === 0) {
    const noSug = document.createElement('div');
    noSug.className = 'no-suggestions';
    noSug.textContent = 'Aucune suggestion';
    box.appendChild(noSug);
  } else {
    const sep = document.createElement('div');
    sep.className = 'suggestion-separator';
    box.appendChild(sep);

    for (const sug of error.suggestions.slice(0, 5)) {
      const item = document.createElement('button');
      item.className = 'suggestion-item';
      item.textContent = sug;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        replaceCallback(error.from, error.to, sug);
        hideSuggestionBox();
      });
      box.appendChild(item);
    }
  }

  // Positionner sous le mot
  box.style.display = 'block';
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

// ── Helpers ──────────────────────────────────────────────────────
function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as unknown as T;
}

/**
 * Construit un tableau rapide : textContentIndex → position ProseMirror.
 * O(n) construction, O(1) lookup.
 */
function buildTextMap(doc: InstanceType<typeof import('@tiptap/pm/model').Node>) {
  const map: number[] = []; // map[textIdx] = pmPos
  doc.descendants((node: { isText: boolean; text?: string | null }, pos: number) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        map.push(pos + i);
      }
    }
    return true;
  });
  return map;
}

// ── Plugin key ───────────────────────────────────────────────────
const spellcheckPluginKey = new PluginKey('languagetool-spellcheck');

// ── Extension ────────────────────────────────────────────────────
export interface SpellCheckOptions {
  language: string;
  debounceMs: number;
}

export const SpellCheckExtension = Extension.create<SpellCheckOptions>({
  name: 'languagetoolSpellcheck',

  addOptions() {
    return { language: 'fr', debounceMs: 800 };
  },

  addProseMirrorPlugins() {
    const language = this.options.language;
    const debounceMs = this.options.debounceMs;

    return [
      new Plugin({
        key: spellcheckPluginKey,

        state: {
          init() {
            return { decorationSet: DecorationSet.empty, errors: [] as SpellError[] };
          },
          apply(tr, value) {
            const meta = tr.getMeta(spellcheckPluginKey);
            if (meta) return meta;
            if (tr.docChanged) {
              return {
                decorationSet: value.decorationSet.map(tr.mapping, tr.doc),
                errors: value.errors,
              };
            }
            return value;
          },
        },

        props: {
          decorations(state) {
            const pluginState = spellcheckPluginKey.getState(state);
            return pluginState?.decorationSet ?? DecorationSet.empty;
          },

          handleClick(view: EditorView, pos: number) {
            const pluginState = spellcheckPluginKey.getState(view.state);
            if (!pluginState) return false;

            const error = pluginState.errors.find(
              (e: SpellError) => pos >= e.from && pos < e.to
            );

            if (!error) {
              hideSuggestionBox();
              return false;
            }

            showSuggestionForError(view, error);
            return true;
          },
        },

        view(editorView: EditorView) {
          // Créer la suggestion box au démarrage
          ensureSuggestionBox();

          // Fermer la suggestion box au clic en dehors
          const handleDocMousedown = (e: MouseEvent) => {
            const box = ensureSuggestionBox();
            if (!box.contains(e.target as Node)) {
              hideSuggestionBox();
            }
          };
          document.addEventListener('mousedown', handleDocMousedown);

          // Listener DOM direct sur l'éditeur pour les clics sur les mots soulignés
          // (fallback si ProseMirror handleClick ne se déclenche pas)
          const handleEditorClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const highlight = target.closest('.spellchecker-word-highlight');
            if (!highlight) return;

            const pluginState = spellcheckPluginKey.getState(editorView.state);
            if (!pluginState) return;

            // Trouver la position ProseMirror du clic
            const pos = editorView.posAtCoords({ left: e.clientX, top: e.clientY });
            if (!pos) return;

            const error = pluginState.errors.find(
              (err: SpellError) => pos.pos >= err.from && pos.pos < err.to
            );

            if (error) {
              e.preventDefault();
              e.stopPropagation();
              showSuggestionForError(editorView, error);
            }
          };
          editorView.dom.addEventListener('click', handleEditorClick);

          // Vérification orthographique
          async function runCheck() {
            const { doc } = editorView.state;
            const fullText = doc.textContent;
            if (!fullText.trim()) {
              const tr = editorView.state.tr.setMeta(spellcheckPluginKey, {
                decorationSet: DecorationSet.empty,
                errors: [],
              });
              editorView.dispatch(tr);
              return;
            }

            try {
              const data = await checkText(fullText, language);
              const textMap = buildTextMap(doc);
              const errors: SpellError[] = [];
              const decorations: Decoration[] = [];

              for (const match of data.matches) {
                const cat = match.rule.category.id;
                if (cat === 'TYPOGRAPHY' || cat === 'STYLE') continue;

                const fromIdx = match.offset;
                const toIdx = match.offset + match.length - 1;

                if (fromIdx >= textMap.length || toIdx >= textMap.length) continue;

                const pmFrom = textMap[fromIdx];
                const pmTo = textMap[toIdx] + 1;

                const error: SpellError = {
                  from: pmFrom,
                  to: pmTo,
                  word: fullText.slice(match.offset, match.offset + match.length),
                  message: match.message,
                  suggestions: match.replacements.slice(0, 5).map((r) => r.value),
                };
                errors.push(error);
                decorations.push(
                  Decoration.inline(pmFrom, pmTo, {
                    class: 'spellchecker-word-highlight',
                    nodeName: 'span',
                  })
                );
              }

              // Vérifier que le doc n'a pas changé pendant l'appel API
              if (editorView.state.doc.eq(doc)) {
                const tr = editorView.state.tr.setMeta(spellcheckPluginKey, {
                  decorationSet: DecorationSet.create(doc, decorations),
                  errors,
                });
                editorView.dispatch(tr);
              }
            } catch (err) {
              console.warn('[SpellCheck] Erreur LanguageTool :', err);
            }
          }

          const debouncedCheck = debounce(runCheck as (...args: never[]) => void, debounceMs);
          debouncedCheck();

          return {
            update() {
              debouncedCheck();
            },
            destroy() {
              document.removeEventListener('mousedown', handleDocMousedown);
              editorView.dom.removeEventListener('click', handleEditorClick);
              hideSuggestionBox();
            },
          };
        },
      }),
    ];

    function showSuggestionForError(view: EditorView, error: SpellError) {
      const coords = view.coordsAtPos(error.from);
      const coordsEnd = view.coordsAtPos(error.to);
      const rect = new DOMRect(
        coords.left,
        coords.top,
        coordsEnd.right - coords.left,
        coords.bottom - coords.top
      );

      showSuggestionBox(error, rect, (from, to, text) => {
        const tr = view.state.tr.replaceWith(from, to, view.state.schema.text(text));
        view.dispatch(tr);
      });
    }
  },
});
