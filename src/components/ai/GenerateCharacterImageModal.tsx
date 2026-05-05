import { useMemo, useState } from 'react';
import { X, Sparkles, Loader2, Check, AlertTriangle, Palette, ImageIcon, RotateCw, Wand2, Eye, Trash2 } from 'lucide-react';
import { ai, AI_IMAGE_STYLES, buildCharacterImagePrompt } from '@/lib/ai';
import type { Character, AiImageStyle, GeneratedCharacterImage } from '@/types';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { generateId, now } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  character: Character;
  onClose: () => void;
  onAccept: (imageUrl: string) => void;
}

type Mode = 'preset' | 'reference';
const HISTORY_MAX = 10;

export function GenerateCharacterImageModal({ open, character, onClose, onAccept }: Props) {
  const bookTitle = useBookStore((s) => s.title);
  const bookGenre = useBookStore((s) => s.genre);
  const bookSynopsis = useBookStore((s) => s.synopsis);
  const { characters: allCharacters, updateCharacter } = useEncyclopediaStore();

  const referenceCandidates = useMemo(
    () => allCharacters.filter((c: Character) => c.id !== character.id && !!c.imageUrl),
    [allCharacters, character.id],
  );
  const hasReferences = referenceCandidates.length > 0;

  const liveCharacter = allCharacters.find((c: Character) => c.id === character.id) ?? character;
  const history = liveCharacter.generatedImages ?? [];

  const [mode, setMode] = useState<Mode>('preset');
  const [style, setStyle] = useState<AiImageStyle>('realistic');
  const [referenceCharId, setReferenceCharId] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const referenceChar = referenceCandidates.find((c) => c.id === referenceCharId);
  const canGenerate = mode === 'preset' || (mode === 'reference' && !!referenceChar?.imageUrl);

  const appendHistory = (url: string) => {
    const newEntry: GeneratedCharacterImage = { id: generateId(), url, createdAt: now() };
    const merged = [newEntry, ...history.filter((h) => h.url !== url)].slice(0, HISTORY_MAX);
    updateCharacter(character.id, { generatedImages: merged });
  };

  const removeFromHistory = (id: string) => {
    updateCharacter(character.id, { generatedImages: history.filter((h) => h.id !== id) });
  };

  const runGeneration = async (kind: 'fresh' | 'iterate') => {
    setGenerating(true);
    setError('');
    try {
      const useReference = mode === 'reference' && !!referenceChar?.imageUrl;
      const useIterate = kind === 'iterate' && !!previewUrl && !useReference;
      const prompt = buildCharacterImagePrompt({
        character: liveCharacter,
        style: useReference ? null : style,
        useReference,
        extraPrompt,
        book: { title: bookTitle, genre: bookGenre, synopsis: bookSynopsis },
      });
      const result = await ai.generateCharacterImage({
        prompt,
        style: useReference ? null : style,
        referenceImageUrl: useReference ? referenceChar?.imageUrl : undefined,
        iterateImageUrl: useIterate ? previewUrl ?? undefined : undefined,
      });
      setPreviewUrl(result.url);
      appendHistory(result.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = () => {
    if (previewUrl) {
      onAccept(previewUrl);
      onClose();
    }
  };

  const handleClose = () => {
    setPreviewUrl(null);
    setExtraPrompt('');
    setError('');
    setMode('preset');
    setReferenceCharId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-500/40 p-4">
      <div className="bg-parchment-50 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-parchment-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-bordeaux-500" />
            <h2 className="font-display text-lg font-semibold text-ink-500">Générer une image</h2>
          </div>
          <button onClick={handleClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-sm text-ink-300">
            Une image de <span className="font-medium text-ink-500">{character.name} {character.surname}</span> sera générée
            à partir de sa fiche.
          </p>

          {hasReferences && (
            <div>
              <label className="label-field">Source d'inspiration</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('preset')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                    mode === 'preset'
                      ? 'border-bordeaux-500 bg-bordeaux-50 text-bordeaux-600'
                      : 'border-parchment-200 text-ink-300 hover:border-parchment-300',
                  )}
                >
                  <Palette className="w-4 h-4" />
                  Style prédéfini
                </button>
                <button
                  onClick={() => setMode('reference')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                    mode === 'reference'
                      ? 'border-bordeaux-500 bg-bordeaux-50 text-bordeaux-600'
                      : 'border-parchment-200 text-ink-300 hover:border-parchment-300',
                  )}
                >
                  <ImageIcon className="w-4 h-4" />
                  Image de référence
                </button>
              </div>
            </div>
          )}

          {mode === 'preset' && (
            <div>
              <label className="label-field">Style graphique</label>
              <div className="grid grid-cols-3 gap-2">
                {AI_IMAGE_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                      style === s.id
                        ? 'border-bordeaux-500 bg-bordeaux-50 text-bordeaux-600'
                        : 'border-parchment-200 text-ink-300 hover:border-parchment-300',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'reference' && (
            <div>
              <label className="label-field">S'inspirer du style de</label>
              <p className="text-xs text-ink-200 mb-2">
                L'image sélectionnée servira de référence stylistique. Le contenu (visage, traits) sera généré depuis la fiche.
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {referenceCandidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setReferenceCharId(c.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all',
                      referenceCharId === c.id
                        ? 'border-bordeaux-500 bg-bordeaux-50'
                        : 'border-parchment-200 hover:border-parchment-300',
                    )}
                  >
                    <CharacterAvatar
                      imageUrl={c.imageUrl}
                      imageOffsetY={c.imageOffsetY}
                      name={c.name}
                      size={16}
                    />
                    <span className="text-xs text-ink-400 truncate max-w-full">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label-field">
              Précisions complémentaires <span className="text-ink-200 font-normal">(optionnel)</span>
            </label>
            <textarea
              className="input-field min-h-[80px] resize-y"
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder="Ex : plus jeune, moins triste, cheveux longs roux, lumière de coucher de soleil…"
              maxLength={500}
            />
            {previewUrl && (
              <p className="text-xs text-ink-200 mt-1">
                « Affiner » applique ces précisions à l'aperçu courant en gardant son identité.
              </p>
            )}
          </div>

          {previewUrl && (
            <div>
              <label className="label-field">Aperçu</label>
              <div className="bg-parchment-100 rounded-lg p-3 flex justify-center">
                <img
                  src={previewUrl}
                  alt="Aperçu généré"
                  className="max-h-80 rounded-lg shadow-md"
                />
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <label className="label-field">Historique des générations</label>
              <p className="text-xs text-ink-200 mb-2">
                Cliquez pour mettre en aperçu (sans coût). Les {HISTORY_MAX} dernières sont conservées.
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {history.map((h) => (
                  <div key={h.id} className="relative group">
                    <button
                      onClick={() => setPreviewUrl(h.url)}
                      className={cn(
                        'block w-full aspect-square rounded-lg overflow-hidden border-2 transition-all',
                        previewUrl === h.url ? 'border-bordeaux-500' : 'border-transparent hover:border-parchment-300',
                      )}
                      title="Mettre en aperçu"
                    >
                      <img src={h.url} alt="" className="w-full h-full object-cover" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-ink-500/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg p-1">
                      <button
                        onClick={() => { setPreviewUrl(h.url); onAccept(h.url); onClose(); }}
                        className="p-1 text-white hover:text-gold-300"
                        title="Utiliser comme avatar"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPreviewUrl(h.url)}
                        className="p-1 text-white hover:text-gold-300"
                        title="Voir en aperçu"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeFromHistory(h.id)}
                        className="p-1 text-white hover:text-red-300"
                        title="Retirer de l'historique"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-parchment-200 bg-parchment-100 flex-wrap">
          <button onClick={handleClose} className="btn-ghost text-sm">Annuler</button>
          {previewUrl ? (
            <>
              <button
                onClick={() => runGeneration('fresh')}
                disabled={generating || !canGenerate}
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Génération fraîche depuis la fiche (varie beaucoup)"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                Nouvelle variation
              </button>
              <button
                onClick={() => runGeneration('iterate')}
                disabled={generating || mode === 'reference'}
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Modifie l'aperçu courant en appliquant les précisions"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Affiner
              </button>
              <button
                onClick={handleAccept}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Check className="w-4 h-4" />
                Utiliser cette image
              </button>
            </>
          ) : (
            <button
              onClick={() => runGeneration('fresh')}
              disabled={generating || !canGenerate}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Générer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
