/**
 * Extension TipTap qui surligne dans une scène les mots demandés par
 * `useWritingAidStore.highlight`, et marque l'occurrence ciblée
 * (`focusedHit`) avec une classe renforcée + scrollIntoView.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { useWritingAidStore, normalizeWord } from '@/store/useWritingAidStore';

export interface WritingAidHighlightOptions {
  sceneId: string;
}

const pluginKey = new PluginKey('writingAidHighlight');

interface PluginState {
  decorations: DecorationSet;
  /** Position [from, to] de l'occurrence active dans la doc. */
  activePos: { from: number; to: number } | null;
}

function findRangeForText(
  doc: import('@tiptap/pm/model').Node,
  target: string,
): { from: number; to: number } | null {
  if (!target) return null;
  // Recherche dans un seul nœud texte (couvre les phrases sans inline-formatting au milieu)
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isText || !node.text) return;
    const idx = node.text.indexOf(target);
    if (idx !== -1) {
      found = { from: pos + idx, to: pos + idx + target.length };
      return false;
    }
  });
  if (found) return found;
  // Fallback : tentative sur la tête de la phrase (au cas où l'inline-formatting coupe le texte)
  const head = target.slice(0, Math.min(40, target.length));
  if (head.length < 8) return null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isText || !node.text) return;
    const idx = node.text.indexOf(head);
    if (idx !== -1) {
      found = { from: pos + idx, to: pos + idx + head.length };
      return false;
    }
  });
  return found;
}

function buildDecorations(
  doc: import('@tiptap/pm/model').Node,
  sceneId: string,
): PluginState {
  const state = useWritingAidStore.getState();
  const decorations: Decoration[] = [];
  let activePos: PluginState['activePos'] = null;

  // Phrase ciblée (mutuellement exclusive avec mots, garantie côté store)
  const sentence = state.focusedSentence;
  if (sentence && sentence.sceneId === sceneId) {
    const range = findRangeForText(doc, sentence.text);
    if (range) {
      decorations.push(Decoration.inline(range.from, range.to, {
        class: 'wa-highlight wa-highlight-active',
      }));
      activePos = range;
    }
    return { decorations: DecorationSet.create(doc, decorations), activePos };
  }

  // Mots surlignés
  const hl = state.highlight;
  if (!hl || hl.words.length === 0 || !hl.sceneIds.includes(sceneId)) {
    return { decorations: DecorationSet.empty, activePos: null };
  }

  const wordSet = new Set(hl.words.map(normalizeWord));
  const focused = state.focusedHit;
  const focusedIndex =
    focused && focused.sceneId === sceneId ? focused.occurrenceIndex : -1;

  let occurrence = 0;

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    const re = /\p{L}+/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const norm = normalizeWord(m[0]);
      if (!wordSet.has(norm)) continue;
      const from = pos + m.index;
      const to = from + m[0].length;
      const isActive = occurrence === focusedIndex;
      decorations.push(
        Decoration.inline(from, to, {
          class: isActive ? 'wa-highlight wa-highlight-active' : 'wa-highlight',
        })
      );
      if (isActive) activePos = { from, to };
      occurrence++;
    }
  });

  return { decorations: DecorationSet.create(doc, decorations), activePos };
}

export const WritingAidHighlightExtension = Extension.create<WritingAidHighlightOptions>({
  name: 'writingAidHighlight',

  addOptions() {
    return { sceneId: '' };
  },

  addProseMirrorPlugins() {
    const sceneId = this.options.sceneId;

    return [
      new Plugin<PluginState>({
        key: pluginKey,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc, sceneId);
          },
          apply(tr, prev) {
            const externalNonce = tr.getMeta(pluginKey);
            if (externalNonce !== undefined) {
              return buildDecorations(tr.doc, sceneId);
            }
            if (tr.docChanged) {
              return buildDecorations(tr.doc, sceneId);
            }
            return prev;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
        view(editorView) {
          // S'abonne au store pour rafraîchir l'état du plugin et scroller au focus.
          const unsubscribe = useWritingAidStore.subscribe((state, prev) => {
            const hlChanged = state.highlight !== prev.highlight;
            const focusChanged = state.focusedHit !== prev.focusedHit;
            const sentenceChanged = state.focusedSentence !== prev.focusedSentence;
            if (!hlChanged && !focusChanged && !sentenceChanged) return;

            const tr = editorView.state.tr.setMeta(pluginKey, Date.now());
            editorView.dispatch(tr);

            // Scroll si l'occurrence active OU la phrase ciblée est dans cette scène
            const focus = state.focusedHit;
            const sentence = state.focusedSentence;
            const shouldScroll =
              (focusChanged && focus && focus.sceneId === sceneId) ||
              (sentenceChanged && sentence && sentence.sceneId === sceneId);
            if (shouldScroll) {
              requestAnimationFrame(() => {
                const root = editorView.dom as HTMLElement;
                const active = root.querySelector('.wa-highlight-active') as HTMLElement | null;
                if (active) {
                  active.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              });
            }
          });
          return {
            destroy() { unsubscribe(); },
          };
        },
      }),
    ];
  },
});
