import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { AVAILABLE_FONTS, AVAILABLE_FONT_SIZES, AVAILABLE_LINE_HEIGHTS, FONT_STACKS, DEFAULT_LAYOUT } from '@/lib/fonts';
import type { BookFont, BookFontSize, BookLineHeight } from '@/types';
import { LayoutChangeInfoDialog } from '@/components/edition/LayoutChangeInfoDialog';

export function EditionLayoutPage() {
  const navigate = useNavigate();
  const layout = useBookStore((s) => s.layout);
  const updateLayout = useBookStore((s) => s.updateLayout);
  const [showLayoutInfo, setShowLayoutInfo] = useState(false);

  return (
    <div className="page-container max-w-2xl">
      <button
        onClick={() => navigate('/edition')}
        className="flex items-center gap-2 text-sm text-ink-300 hover:text-bordeaux-500 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à l'édition
      </button>

      <h2 className="section-title mb-2">Mise en page</h2>
      <p className="text-sm text-ink-300 mb-6">
        Ces paramètres s'appliquent à l'éditeur, au mode relecture et aux exports (EPUB, PDF, DOCX).
        Ils sont communs à l'édition papier et numérique.
      </p>

      <div className="card-fantasy p-6 mb-6">
        <div className="space-y-5">
          {/* Font family */}
          <div>
            <label className="label-field">Police par défaut</label>
            <select
              value={layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily}
              onChange={(e) => { updateLayout({ fontFamily: e.target.value as BookFont }); setShowLayoutInfo(true); }}
              className="input-field"
            >
              {AVAILABLE_FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: FONT_STACKS[f] }}>{f}</option>
              ))}
            </select>
            <p className="text-xs text-ink-200 mt-1">
              Vous pouvez aussi changer la police d'un texte sélectionné dans l'éditeur.
            </p>
          </div>

          {/* Font size + line height side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Taille de police</label>
              <select
                value={layout?.fontSize ?? DEFAULT_LAYOUT.fontSize}
                onChange={(e) => { updateLayout({ fontSize: Number(e.target.value) as BookFontSize }); setShowLayoutInfo(true); }}
                className="input-field"
              >
                {AVAILABLE_FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s} pt</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Interligne</label>
              <select
                value={layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight}
                onChange={(e) => updateLayout({ lineHeight: Number(e.target.value) as BookLineHeight })}
                className="input-field"
              >
                {AVAILABLE_LINE_HEIGHTS.map((lh) => (
                  <option key={lh} value={lh}>{lh === 1.0 ? 'Simple (1.0)' : lh === 1.5 ? 'Standard (1.5)' : lh === 2.0 ? 'Double (2.0)' : lh.toString()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="border border-parchment-200 rounded-lg p-4 bg-white/60">
            <p className="text-xs text-ink-200 mb-2 font-sans">Aperçu</p>
            <p
              className="text-ink-500 text-justify"
              style={{
                fontFamily: FONT_STACKS[layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily],
                fontSize: `${layout?.fontSize ?? DEFAULT_LAYOUT.fontSize}pt`,
                lineHeight: `${layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight}`,
              }}
            >
              « Il est des lieux où souffle l'esprit, des pages où chaque mot porte le poids d'un monde. L'écrivain, tel un artisan patient, tisse ses phrases avec le soin d'un orfèvre — car chaque virgule, chaque silence, chaque élan du récit est une promesse faite au lecteur. »
            </p>
          </div>
        </div>
      </div>

      {showLayoutInfo && <LayoutChangeInfoDialog onClose={() => setShowLayoutInfo(false)} />}
    </div>
  );
}
