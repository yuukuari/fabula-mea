/**
 * Extension TipTap qui surligne dans une scène les mots demandés par
 * `useWritingAidStore.highlight`, et marque l'occurrence ciblée
 * (`focusedHit`) avec une classe renforcée + scrollIntoView.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { useWritingAidStore, normalizeWord } from '@/store/useWritingAidStore';
import { findRangeForText, findAllRangesForText } from './find-ranges';

export interface WritingAidHighlightOptions {
  sceneId: string;
}

const pluginKey = new PluginKey('writingAidHighlight');

interface PluginState {
  decorations: DecorationSet;
  /** Position [from, to] de l'occurrence active dans la doc. */
  activePos: { from: number; to: number } | null;
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

  // N-grammes (tics de langage) — recherche brute des phrases dans le doc.
  const phr = state.phraseHighlight;
  if (phr && phr.phrases.length > 0 && phr.sceneIds.includes(sceneId)) {
    const focusedPhrase = state.focusedPhrase;
    const focusedIdx =
      focusedPhrase && focusedPhrase.sceneId === sceneId ? focusedPhrase.occurrenceIndex : -1;
    // Collecte toutes les ranges, puis tri par from pour un index stable.
    const allRanges: Array<{ from: number; to: number }> = [];
    for (const phrase of phr.phrases) {
      // Recherche insensible à la casse : tente la forme exacte puis lowercase
      // (les n-grammes sont stockés tels qu'apparus, mais peuvent revenir avec
      // une casse différente en début de phrase).
      const ranges = findAllRangesForText(doc, phrase, { fallbackHead: false });
      for (const r of ranges) allRanges.push(r);
    }
    allRanges.sort((a, b) => a.from - b.from);
    // Dédoublonnage : deux phrases peuvent partager une plage si l'une est
    // préfixe de l'autre.
    const seen = new Set<string>();
    let occurrence = 0;
    for (const r of allRanges) {
      const key = `${r.from}:${r.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const isActive = occurrence === focusedIdx;
      decorations.push(Decoration.inline(r.from, r.to, {
        class: isActive ? 'wa-highlight wa-highlight-active' : 'wa-highlight',
      }));
      if (isActive) activePos = r;
      occurrence++;
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
            const phraseChanged = state.phraseHighlight !== prev.phraseHighlight;
            const focusedPhraseChanged = state.focusedPhrase !== prev.focusedPhrase;
            if (!hlChanged && !focusChanged && !sentenceChanged && !phraseChanged && !focusedPhraseChanged) return;

            const tr = editorView.state.tr.setMeta(pluginKey, Date.now());
            editorView.dispatch(tr);

            // Scroll si l'occurrence active OU la phrase ciblée est dans cette scène
            const focus = state.focusedHit;
            const sentence = state.focusedSentence;
            const focusedPhrase = state.focusedPhrase;
            const shouldScroll =
              (focusChanged && focus && focus.sceneId === sceneId) ||
              (sentenceChanged && sentence && sentence.sceneId === sceneId) ||
              (focusedPhraseChanged && focusedPhrase && focusedPhrase.sceneId === sceneId);
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
