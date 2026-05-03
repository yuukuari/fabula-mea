import { Extension, textInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const NBSP = ' ';
const BEFORE_NBSP = new Set([':', ';', '!', '?', '»', '%']);
const AFTER_NBSP = new Set(['«']);

/**
 * Typographie française appliquée à la saisie :
 * - espace insécable avant `:` `;` `!` `?` `»` `%` (remplace l'espace normale tapée)
 * - espace insécable après `«`
 * - `--` → `–` (semi-cadratin), `---` → `—` (cadratin)
 *
 * Les valeurs littérales sont stockées telles quelles dans le HTML TipTap (caractère
 * U+00A0). Les pipelines d'export PDF/EPUB/DOCX et les compteurs (`countWordsFromHtml`,
 * `countCharacters`) le préservent ; `\s` côté JS regex matche le NBSP.
 */
export const FrenchTypography = Extension.create({
  name: 'frenchTypography',

  addInputRules() {
    return [
      // `---` → `—` (cadratin)
      textInputRule({ find: /---$/, replace: '—' }),
      // `–-` → `—` : rattrape le cas où `--` a déjà été converti en `–` puis l'utilisateur tape un 3ᵉ `-`
      textInputRule({ find: /–-$/, replace: '—' }),
      // `--` → `–` (semi-cadratin)
      textInputRule({ find: /--$/, replace: '–' }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('frenchTypography'),
        props: {
          handleTextInput(view, from, to, text) {
            if (text.length !== 1) return false;
            const { state } = view;
            const { schema } = state;

            if (BEFORE_NBSP.has(text)) {
              const charBefore = state.doc.textBetween(Math.max(0, from - 1), from, '\n', '\n');
              if (charBefore !== ' ') return false;
              const tr = state.tr;
              tr.replaceWith(from - 1, from, schema.text(NBSP));
              tr.replaceWith(from, to, schema.text(text));
              view.dispatch(tr);
              return true;
            }

            if (AFTER_NBSP.has(text)) {
              view.dispatch(state.tr.insertText(text + NBSP, from, to));
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
