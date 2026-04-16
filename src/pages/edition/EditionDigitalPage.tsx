import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Info } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import type { BookRights } from '@/types';

const RIGHTS_OPTIONS: { value: BookRights; label: string; description: string }[] = [
  { value: 'all_rights_reserved', label: 'Tous droits réservés', description: 'Aucune reproduction sans autorisation écrite.' },
  { value: 'cc_by', label: 'CC BY 4.0', description: 'Attribution — réutilisation libre avec mention.' },
  { value: 'cc_by_sa', label: 'CC BY-SA 4.0', description: 'Attribution + Partage dans les mêmes conditions.' },
  { value: 'cc_by_nc', label: 'CC BY-NC 4.0', description: 'Attribution + Pas d\'utilisation commerciale.' },
  { value: 'cc_by_nc_sa', label: 'CC BY-NC-SA 4.0', description: 'Attribution + Non-commercial + Partage identique.' },
  { value: 'cc_by_nd', label: 'CC BY-ND 4.0', description: 'Attribution + Pas de modification.' },
  { value: 'cc_by_nc_nd', label: 'CC BY-NC-ND 4.0', description: 'Attribution + Non-commercial + Pas de modification.' },
  { value: 'public_domain', label: 'Domaine public', description: 'Œuvre libre de droits.' },
];

const COMMON_LANGUAGES: { code: string; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'Anglais' },
  { code: 'es', label: 'Espagnol' },
  { code: 'de', label: 'Allemand' },
  { code: 'it', label: 'Italien' },
  { code: 'pt', label: 'Portugais' },
  { code: 'nl', label: 'Néerlandais' },
  { code: 'ja', label: 'Japonais' },
  { code: 'zh', label: 'Chinois' },
  { code: 'ru', label: 'Russe' },
];

function validateIsbn(isbn: string): boolean {
  if (!isbn) return true; // empty is fine (optional)
  const digits = isbn.replace(/[^0-9X]/gi, '');
  return digits.length === 10 || digits.length === 13;
}

export function EditionDigitalPage() {
  const navigate = useNavigate();
  const digital = useBookStore((s) => s.layout?.digitalEdition);
  const updateDigitalEdition = useBookStore((s) => s.updateDigitalEdition);
  const synopsis = useBookStore((s) => s.synopsis);
  const genre = useBookStore((s) => s.genre);

  const [keywordInput, setKeywordInput] = useState('');
  const keywordInputRef = useRef<HTMLInputElement>(null);

  const description = digital?.description ?? '';
  const keywords = digital?.keywords ?? [];
  const isbnDigital = digital?.isbnDigital ?? '';
  const rights = digital?.rights ?? 'all_rights_reserved';
  const language = digital?.language ?? 'fr';
  const publisher = digital?.publisher ?? '';

  const isbnValid = validateIsbn(isbnDigital);

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    updateDigitalEdition({ keywords: [...keywords, trimmed] });
  };

  const removeKeyword = (kw: string) => {
    updateDigitalEdition({ keywords: keywords.filter((k) => k !== kw) });
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(keywordInput);
      setKeywordInput('');
    } else if (e.key === 'Backspace' && !keywordInput && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1]);
    }
  };

  const handleKeywordPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted.includes(',')) {
      e.preventDefault();
      pasted.split(',').forEach((k) => addKeyword(k));
      setKeywordInput('');
    }
  };

  return (
    <div className="page-container max-w-3xl">
      <button
        onClick={() => navigate('/edition')}
        className="flex items-center gap-2 text-sm text-ink-300 hover:text-bordeaux-500 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à l'édition
      </button>

      <h2 className="section-title mb-2">Édition numérique</h2>
      <p className="text-sm text-ink-300 mb-6">
        Métadonnées intégrées à votre fichier EPUB. Ces informations sont utilisées par les boutiques
        en ligne (Kindle, Apple Books, Kobo, Google Play) et les liseuses pour référencer votre livre.
        Vos choix sont enregistrés automatiquement.
      </p>

      <div className="space-y-5">
        {/* Description */}
        <div className="card-fantasy p-6">
          <label className="block mb-2">
            <span className="font-display font-semibold text-ink-500">Description longue</span>
            <span className="text-xs text-ink-300 ml-2">(optionnel)</span>
          </label>
          <p className="text-xs text-ink-300 mb-3">
            Texte commercial affiché sur les pages produit (Amazon, FNAC, etc.). Vous pouvez en profiter
            pour être plus accrocheur que le synopsis.
            {synopsis && !description && (
              <> À défaut, le synopsis du livre sera utilisé.</>
            )}
          </p>
          <textarea
            value={description}
            onChange={(e) => updateDigitalEdition({ description: e.target.value })}
            placeholder={synopsis ? `Synopsis actuel : « ${synopsis.slice(0, 80)}${synopsis.length > 80 ? '…' : ''} »\n\nOu rédigez une description plus commerciale ici.` : "Résumez l'intrigue, les thèmes et l'ambiance pour accrocher le lecteur."}
            className="textarea-field min-h-[140px]"
          />
          <p className="text-xs text-ink-200 mt-2 text-right">{description.length} caractères</p>
        </div>

        {/* Keywords */}
        <div className="card-fantasy p-6">
          <label className="block mb-2">
            <span className="font-display font-semibold text-ink-500">Mots-clés</span>
            <span className="text-xs text-ink-300 ml-2">(jusqu'à 7 recommandés)</span>
          </label>
          <p className="text-xs text-ink-300 mb-3">
            Utilisés comme <code className="bg-parchment-100 px-1 rounded">dc:subject</code> dans l'EPUB.
            Aident à référencer votre livre dans les moteurs de recherche des boutiques.
            {genre && !keywords.length && <> Votre genre « <b>{genre}</b> » sera ajouté automatiquement à défaut.</>}
          </p>
          <div
            onClick={() => keywordInputRef.current?.focus()}
            className="flex flex-wrap gap-2 items-center p-2 border border-parchment-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-gold-400 focus-within:border-gold-400 transition-colors cursor-text"
          >
            {keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2 py-1 bg-bordeaux-50 text-bordeaux-600 text-xs font-medium rounded"
              >
                {kw}
                <button
                  onClick={(e) => { e.stopPropagation(); removeKeyword(kw); }}
                  className="hover:bg-bordeaux-100 rounded p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              ref={keywordInputRef}
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
              onPaste={handleKeywordPaste}
              onBlur={() => { if (keywordInput.trim()) { addKeyword(keywordInput); setKeywordInput(''); } }}
              placeholder={keywords.length === 0 ? 'Fantasy, aventure, magie…' : ''}
              className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm text-ink-500 placeholder-ink-200"
            />
          </div>
          <p className="text-xs text-ink-200 mt-2">
            Entrée ou virgule pour ajouter. Retour arrière pour effacer le dernier.
          </p>
        </div>

        {/* ISBN + language grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card-fantasy p-6">
            <label className="block mb-2">
              <span className="font-display font-semibold text-ink-500">ISBN numérique</span>
              <span className="text-xs text-ink-300 ml-2">(optionnel)</span>
            </label>
            <p className="text-xs text-ink-300 mb-3">
              Distinct de l'ISBN papier. Obligatoire pour la vente chez certains distributeurs.
            </p>
            <input
              type="text"
              value={isbnDigital}
              onChange={(e) => updateDigitalEdition({ isbnDigital: e.target.value })}
              placeholder="978-2-..."
              className={`input-field ${isbnDigital && !isbnValid ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''}`}
            />
            {isbnDigital && !isbnValid && (
              <p className="text-xs text-red-500 mt-1">L'ISBN doit contenir 10 ou 13 chiffres.</p>
            )}
          </div>

          <div className="card-fantasy p-6">
            <label className="block mb-2">
              <span className="font-display font-semibold text-ink-500">Langue principale</span>
            </label>
            <p className="text-xs text-ink-300 mb-3">
              Code utilisé pour <code className="bg-parchment-100 px-1 rounded">dc:language</code>.
            </p>
            <select
              value={language}
              onChange={(e) => updateDigitalEdition({ language: e.target.value })}
              className="input-field"
            >
              {COMMON_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Publisher */}
        <div className="card-fantasy p-6">
          <label className="block mb-2">
            <span className="font-display font-semibold text-ink-500">Éditeur numérique</span>
            <span className="text-xs text-ink-300 ml-2">(optionnel)</span>
          </label>
          <p className="text-xs text-ink-300 mb-3">
            Peut différer de l'éditeur papier. Laissez vide pour auto-édition.
          </p>
          <input
            type="text"
            value={publisher}
            onChange={(e) => updateDigitalEdition({ publisher: e.target.value })}
            placeholder="Nom de l'éditeur ou votre nom d'auteur-éditeur"
            className="input-field"
          />
        </div>

        {/* Rights */}
        <div className="card-fantasy p-6">
          <label className="block mb-2">
            <span className="font-display font-semibold text-ink-500">Licence / droits d'auteur</span>
          </label>
          <p className="text-xs text-ink-300 mb-3">
            Choisissez la licence qui s'applique à votre œuvre. Sera intégrée dans les métadonnées EPUB.
          </p>
          <div className="space-y-2">
            {RIGHTS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  rights === opt.value
                    ? 'border-bordeaux-400 bg-bordeaux-50/40'
                    : 'border-parchment-200 hover:border-parchment-400'
                }`}
              >
                <input
                  type="radio"
                  name="rights"
                  value={opt.value}
                  checked={rights === opt.value}
                  onChange={() => updateDigitalEdition({ rights: opt.value })}
                  className="mt-0.5 accent-bordeaux-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-500">{opt.label}</p>
                  <p className="text-xs text-ink-300 mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Info footer */}
        <div className="p-4 rounded-lg bg-bordeaux-50/40 border border-bordeaux-100 flex items-start gap-3">
          <Info className="w-5 h-5 text-bordeaux-500 shrink-0 mt-0.5" />
          <div className="text-xs text-ink-400">
            Ces informations sont intégrées automatiquement au fichier EPUB à l'export.
            Les boutiques en ligne demandent souvent des métadonnées complémentaires (prix, catégorie, etc.)
            qui sont renseignées directement sur leurs plateformes.
          </div>
        </div>
      </div>
    </div>
  );
}
