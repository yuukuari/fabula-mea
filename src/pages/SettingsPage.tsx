import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, PenLine, AlertTriangle, X, Library, ExternalLink, History, Cloud, HardDrive, RotateCcw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useLibraryStore, getBookStorageKey } from '@/store/useLibraryStore';
import { useSagaStore } from '@/store/useSagaStore';
import { useSyncStore } from '@/store/useSyncStore';
import { AVAILABLE_FONTS, AVAILABLE_FONT_SIZES, AVAILABLE_LINE_HEIGHTS, FONT_STACKS, DEFAULT_LAYOUT } from '@/lib/fonts';
import { api } from '@/lib/api';
import { Modal } from '@/components/shared/Modal';
import type { WritingMode, BookFont, BookFontSize, BookLineHeight, BookLayout, VersionMeta, BookProject } from '@/types';

/** Modale de confirmation de changement de mode */
function WritingModeChangeDialog({
  fromMode,
  toMode,
  onConfirm,
  onCancel,
}: {
  fromMode: WritingMode;
  toMode: WritingMode;
  onConfirm: (deleteContent: boolean) => void;
  onCancel: () => void;
}) {
  const isWriteToCount = fromMode === 'write' && toMode === 'count';
  const scenes = useBookStore((s) => s.scenes);
  const scenesWithContent = scenes.filter((s) => s.content && s.content !== '<p></p>').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 btn-ghost p-1">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-gold-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-ink-500">Changer le mode d'écriture</h3>
            <p className="text-sm text-ink-300 mt-1">
              {isWriteToCount
                ? `Vous passez du mode Écriture au mode Comptage.`
                : `Vous passez du mode Comptage au mode Écriture.`}
            </p>
          </div>
        </div>

        {isWriteToCount && scenesWithContent > 0 ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
              <strong>{scenesWithContent} scène{scenesWithContent > 1 ? 's' : ''}</strong> contiennent du texte rédigé dans l'application.
              Que souhaitez-vous faire de ces textes ?
            </div>
            <div className="space-y-3">
              <button
                onClick={() => onConfirm(false)}
                className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-parchment-200
                           hover:border-bordeaux-300 hover:bg-bordeaux-50/30 transition-all text-left"
              >
                <div className="w-8 h-8 bg-parchment-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Hash className="w-4 h-4 text-ink-400" />
                </div>
                <div>
                  <p className="font-medium text-ink-500 text-sm">Conserver les textes</p>
                  <p className="text-xs text-ink-300 mt-0.5">
                    Les textes sont archivés. Le comptage de mots actuel est conservé, mais vous pourrez le modifier manuellement.
                  </p>
                </div>
              </button>
              <button
                onClick={() => onConfirm(true)}
                className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-parchment-200
                           hover:border-red-300 hover:bg-red-50/30 transition-all text-left"
              >
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <X className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="font-medium text-red-600 text-sm">Supprimer les textes</p>
                  <p className="text-xs text-ink-300 mt-0.5">
                    Tous les textes rédigés dans l'application sont supprimés définitivement. Le comptage de mots est remis à zéro.
                  </p>
                </div>
              </button>
            </div>
            <button onClick={onCancel} className="w-full mt-3 btn-ghost text-sm">Annuler</button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-300 mb-5">
              {isWriteToCount
                ? "Aucun texte rédigé dans l'application — le changement n'entraîne aucune perte de données."
                : "En mode Écriture, vous pourrez rédiger vos scènes directement dans l'application. Le comptage de mots sera calculé automatiquement."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => onConfirm(false)} className="btn-primary flex-1">Confirmer</button>
              <button onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Modale d'information sur le changement de mise en page */
function LayoutChangeInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost p-1">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-display font-bold text-ink-500">Changement de mise en page</h3>
            <p className="text-sm text-ink-300 mt-1">
              Ce paramètre s'applique au texte dont la police n'a pas été modifiée manuellement dans l'éditeur (texte « par défaut »).
            </p>
          </div>
        </div>
        <p className="text-sm text-ink-300 mb-5">
          Les passages auxquels vous avez appliqué une police spécifique dans l'éditeur conservent leur mise en forme individuelle.
          Pour uniformiser tout le texte, utilisez le bouton « Supprimer le formatage » dans l'éditeur de scènes.
        </p>
        <button onClick={onClose} className="w-full btn-primary">Compris</button>
      </div>
    </div>
  );
}

/** Modale de confirmation de transformation en saga */
function TransformToSagaDialog({
  bookTitle,
  onConfirm,
  onCancel,
}: {
  bookTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-parchment-50 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 btn-ghost p-1">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-bordeaux-50 rounded-lg flex items-center justify-center shrink-0">
            <Library className="w-5 h-5 text-bordeaux-500" />
          </div>
          <div>
            <h3 className="font-display font-bold text-ink-500">Transformer en saga</h3>
            <p className="text-sm text-ink-300 mt-1">
              Cette action est irréversible.
            </p>
          </div>
        </div>

        <div className="bg-parchment-100 border border-parchment-200 rounded-xl p-4 mb-5 text-sm text-ink-400 space-y-2">
          <p>
            Le livre <strong>« {bookTitle} »</strong> deviendra le premier tome d'une nouvelle saga.
          </p>
          <p>
            L'encyclopédie (personnages, lieux, univers, cartes) sera partagée au niveau de la saga.
            Les futurs livres ajoutés à cette saga partageront la même encyclopédie.
          </p>
          <p className="text-ink-300">
            Le manuscrit (chapitres, scènes, objectifs) reste propre à chaque livre.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onConfirm} className="btn-primary flex-1">Transformer</button>
          <button onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
        </div>
      </div>
    </div>
  );
}

function formatDiff(diff: number): string {
  if (diff === 0) return '';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) return null;
  const color = diff > 0 ? 'text-emerald-600' : 'text-red-500';
  return <span className={`text-[10px] font-medium ${color}`}>{formatDiff(diff)}</span>;
}

function formatVersionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function VersionDetailModal({
  version,
  prevVersion,
  bookId,
  onClose,
  onRestored,
}: {
  version: VersionMeta;
  prevVersion?: VersionMeta;
  bookId: string;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [fullData, setFullData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    api.books.getVersion(bookId, version.index)
      .then((res) => setFullData(res.data as Record<string, unknown>))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [bookId, version.index]);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const { data: restoredData } = await api.books.restoreVersion(bookId, version.index);
      const project = restoredData as BookProject;
      // Write restored data to localStorage
      localStorage.setItem(getBookStorageKey(bookId), JSON.stringify(project));
      // Reload the page to get a clean store state from the restored data
      window.location.reload();
    } catch {
      setRestoring(false);
      setShowConfirm(false);
    }
  };

  const stats = version.stats;

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold text-ink-500">
          Version du {formatVersionDate(version.savedAt)}
        </h3>
        <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
      </div>

      <div className="bg-parchment-50 rounded-xl p-4 mb-4">
        <p className="text-sm font-medium text-ink-400 mb-3">Contenu de cette version</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {([
            ['Chapitres', stats.chapters, prevVersion?.stats.chapters],
            ['Scènes', stats.scenes, prevVersion?.stats.scenes],
            ['Événements', stats.events, prevVersion?.stats.events],
            ['Mots', stats.words, prevVersion?.stats.words],
            ['Personnages', stats.characters, prevVersion?.stats.characters],
            ['Lieux', stats.places, prevVersion?.stats.places],
            ['Fiches univers', stats.worldNotes, prevVersion?.stats.worldNotes],
            ['Cartes', stats.maps, prevVersion?.stats.maps],
            ['Notes & idées', stats.notes, prevVersion?.stats.notes],
          ] as [string, number, number | undefined][]).map(([label, value, prev]) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-ink-300">{label}</span>
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-ink-500">{label === 'Mots' ? value.toLocaleString('fr-FR') : value}</span>
                {prev != null && <DiffBadge diff={value - prev} />}
              </span>
            </div>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 text-center">
          Impossible de charger les détails de cette version.
        </div>
      ) : !showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-bordeaux-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-bordeaux-600 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          Restaurer cette version
        </button>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 mb-3">
            La version actuelle sera sauvegardée dans l'historique avant la restauration. Voulez-vous continuer ?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="flex-1 flex items-center justify-center gap-2 bg-bordeaux-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-bordeaux-600 transition-colors disabled:opacity-50"
            >
              {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {restoring ? 'Restauration...' : 'Confirmer'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 bg-parchment-100 border border-parchment-300 text-ink-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-parchment-200 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function VersionHistorySection({ bookId }: { bookId: string }) {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionMeta | null>(null);
  const syncStatus = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const hasToken = !!localStorage.getItem('emlb-token');

  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(() => {
    if (!hasToken || !bookId) return;
    setLoading(true);
    setError(null);
    api.books.history(bookId)
      .then((res) => setVersions(res.versions))
      .catch(() => setError('Impossible de charger l\'historique'))
      .finally(() => setLoading(false));
  }, [bookId, hasToken]);

  // Load versions when section is expanded, and refresh when a new sync completes
  useEffect(() => {
    if (expanded) {
      loadVersions();
    }
  }, [expanded, loadVersions, lastSyncedAt]);

  const syncLabel = {
    idle: 'En attente',
    syncing: 'Synchronisation...',
    synced: 'Synchronisé',
    error: 'Erreur de sauvegarde',
  }[syncStatus];

  const syncColor = {
    idle: 'text-ink-300',
    syncing: 'text-blue-500',
    synced: 'text-emerald-500',
    error: 'text-red-500',
  }[syncStatus];

  return (
    <div className="card-fantasy p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-parchment-200 rounded-lg flex items-center justify-center shrink-0">
          <Cloud className="w-5 h-5 text-ink-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-semibold text-ink-500">Sauvegarde et synchronisation</h3>
          {hasToken && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium ${syncColor}`}>{syncLabel}</span>
              {lastSyncedAt && syncStatus === 'synced' && (
                <span className="text-xs text-ink-200">
                  — {formatVersionDate(lastSyncedAt)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-ink-300 mb-4">
        {hasToken
          ? 'Votre livre est sauvegardé localement et synchronisé avec le serveur. Un historique des versions est conservé automatiquement.'
          : 'Votre livre est sauvegardé localement. Connectez-vous pour activer la synchronisation cloud et l\'historique des versions.'}
      </p>

      {hasToken && (
        <div>
          <button
            onClick={() => { setExpanded(!expanded); }}
            className="flex items-center gap-2 text-sm font-medium text-bordeaux-500 hover:text-bordeaux-700 transition-colors"
          >
            <History className="w-4 h-4" />
            Historique des versions
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expanded && (
            <div className="mt-3">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-ink-300 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement...
                </div>
              ) : error ? (
                <div className="text-sm text-red-500 py-3">
                  {error}
                  <button onClick={loadVersions} className="ml-2 underline hover:no-underline">Réessayer</button>
                </div>
              ) : versions.length === 0 ? (
                <p className="text-sm text-ink-200 py-3">
                  Aucune version enregistrée pour le moment. Les versions sont créées automatiquement toutes les 15 minutes lors de la synchronisation.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {versions.map((v, i) => {
                    const prev = versions[i + 1];
                    const hasDiffs = prev != null;
                    const dChap = hasDiffs ? v.stats.chapters - prev.stats.chapters : 0;
                    const dScenes = hasDiffs ? v.stats.scenes - prev.stats.scenes : 0;
                    const dEvents = hasDiffs ? v.stats.events - prev.stats.events : 0;
                    const dWords = hasDiffs ? v.stats.words - prev.stats.words : 0;
                    const dChars = hasDiffs ? v.stats.characters - prev.stats.characters : 0;
                    const dPlaces = hasDiffs ? v.stats.places - prev.stats.places : 0;
                    const anyDiff = dChap || dScenes || dEvents || dWords || dChars || dPlaces;

                    return (
                      <button
                        key={v.index}
                        onClick={() => setSelectedVersion(v)}
                        className="w-full flex items-center justify-between p-3 bg-parchment-50 hover:bg-parchment-100 rounded-lg transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink-500 flex items-center gap-1.5">
                            {formatVersionDate(v.savedAt)}
                            {v.isRestore && (
                              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                avant restauration
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-ink-300 mt-0.5">
                            {v.stats.chapters} chap. · {v.stats.scenes} scènes · {v.stats.events} évén. · {v.stats.words.toLocaleString('fr-FR')} mots
                          </p>
                          {hasDiffs && anyDiff ? (
                            <p className="text-[10px] mt-1 flex flex-wrap gap-x-2">
                              {dChap !== 0 && <span><DiffBadge diff={dChap} /> chap.</span>}
                              {dScenes !== 0 && <span><DiffBadge diff={dScenes} /> scènes</span>}
                              {dEvents !== 0 && <span><DiffBadge diff={dEvents} /> évén.</span>}
                              {dWords !== 0 && <span><DiffBadge diff={dWords} /> mots</span>}
                              {dChars !== 0 && <span><DiffBadge diff={dChars} /> perso.</span>}
                              {dPlaces !== 0 && <span><DiffBadge diff={dPlaces} /> lieux</span>}
                            </p>
                          ) : null}
                        </div>
                        <RotateCcw className="w-4 h-4 text-ink-200 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
              {versions.length > 0 && (
                <button
                  onClick={loadVersions}
                  className="mt-2 text-xs text-ink-200 hover:text-ink-400 transition-colors"
                >
                  Rafraîchir
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {selectedVersion && (
        <VersionDetailModal
          version={selectedVersion}
          prevVersion={versions[versions.findIndex((v) => v.index === selectedVersion.index) + 1]}
          bookId={bookId}
          onClose={() => setSelectedVersion(null)}
          onRestored={() => {
            setSelectedVersion(null);
            loadVersions();
          }}
        />
      )}
    </div>
  );
}

export function SettingsPage() {
  const title = useBookStore((s) => s.title);
  const author = useBookStore((s) => s.author);
  const genre = useBookStore((s) => s.genre);
  const synopsis = useBookStore((s) => s.synopsis);
  const writingMode = useBookStore((s) => s.writingMode);
  const countUnit = useBookStore((s) => s.countUnit ?? 'words');
  const sagaId = useBookStore((s) => s.sagaId);
  const bookId = useBookStore((s) => s.id);
  const updateProject = useBookStore((s) => s.updateProject);
  const updateWritingMode = useBookStore((s) => s.updateWritingMode);
  const updateCountUnit = useBookStore((s) => s.updateCountUnit);
  const [pendingMode, setPendingMode] = useState<WritingMode | null>(null);
  const [showLayoutInfo, setShowLayoutInfo] = useState(false);
  const [showTransformSaga, setShowTransformSaga] = useState(false);

  const layout = useBookStore((s) => s.layout);
  const updateLayout = useBookStore((s) => s.updateLayout);

  const handleTransformToSaga = () => {
    const bookState = useBookStore.getState();
    // 1. Create saga in library
    const newSagaId = useLibraryStore.getState().createSaga(bookState.title, {
      author: bookState.author,
      genre: bookState.genre ?? '',
      writingMode: bookState.writingMode,
      countUnit: bookState.countUnit ?? 'words',
      layout: bookState.layout,
    });
    // 2. Init saga store with book's encyclopedia data
    useSagaStore.getState().initNewSaga(newSagaId, bookState.title);
    // Copy encyclopedia data from book to saga
    const sagaStore = useSagaStore.getState();
    const sagaSet = useSagaStore.setState;
    sagaSet({
      characters: bookState.characters,
      places: bookState.places,
      worldNotes: bookState.worldNotes,
      maps: bookState.maps,
      tags: bookState.tags,
      graphNodePositions: bookState.graphNodePositions ?? {},
    });
    sagaStore.saveSaga();
    // 3. Link book to saga
    useLibraryStore.getState().addBookToSaga(newSagaId, bookId);
    // 4. Clear encyclopedia data from book and set sagaId
    useBookStore.setState({
      sagaId: newSagaId,
      characters: [],
      places: [],
      worldNotes: [],
      maps: [],
      tags: [],
      graphNodePositions: {},
    });
    useBookStore.getState().saveBook();
    setShowTransformSaga(false);
  };

  const navigate = useNavigate();
  const sagas = useLibraryStore((s) => s.sagas);
  const saga = sagaId ? sagas.find((s) => s.id === sagaId) : null;

  return (
    <div className="page-container max-w-2xl">
      <h2 className="section-title mb-6">Parametres</h2>

      {/* Saga banner — shown first when book belongs to a saga */}
      {saga && (
        <div className="card-fantasy p-6 mb-6 border-bordeaux-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-bordeaux-50 rounded-lg flex items-center justify-center shrink-0">
              <Library className="w-5 h-5 text-bordeaux-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg font-semibold text-ink-500">Saga « {saga.title} »</h3>
              <p className="text-sm text-ink-300">
                L'auteur, le genre, le mode d'écriture, l'unité de comptage et la mise en page sont définis au niveau de la saga.
              </p>
            </div>
          </div>

          <div className="bg-parchment-100/60 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <span className="text-ink-200 text-xs">Auteur</span>
                <p className="text-ink-500 font-medium">{saga.author || <span className="text-ink-200 italic">Non renseigné</span>}</p>
              </div>
              <div>
                <span className="text-ink-200 text-xs">Genre</span>
                <p className="text-ink-500 font-medium">{saga.genre || <span className="text-ink-200 italic">Non renseigné</span>}</p>
              </div>
              <div>
                <span className="text-ink-200 text-xs">Mode d'écriture</span>
                <p className="text-ink-500 font-medium">{saga.writingMode === 'write' ? 'Écriture intégrée' : 'Comptage de mots'}</p>
              </div>
              <div>
                <span className="text-ink-200 text-xs">Unité de comptage</span>
                <p className="text-ink-500 font-medium">{saga.countUnit === 'characters' ? 'Signes (espaces compris)' : 'Mots'}</p>
              </div>
              <div>
                <span className="text-ink-200 text-xs">Police</span>
                <p className="text-ink-500 font-medium">{(saga.layout ?? DEFAULT_LAYOUT).fontFamily}</p>
              </div>
              <div>
                <span className="text-ink-200 text-xs">Taille / Interligne</span>
                <p className="text-ink-500 font-medium">{(saga.layout ?? DEFAULT_LAYOUT).fontSize} pt / {(saga.layout ?? DEFAULT_LAYOUT).lineHeight}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/saga/${sagaId}`)}
            className="flex items-center gap-2 text-sm text-bordeaux-500 hover:text-bordeaux-700 font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Modifier les paramètres de la saga
          </button>
        </div>
      )}

      {/* Book info */}
      <div className="card-fantasy p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">
          {saga ? 'Informations du livre' : 'Informations du projet'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="label-field">Titre du livre</label>
            <input value={title} onChange={(e) => updateProject({ title: e.target.value })} className="input-field" />
          </div>
          {!saga && (
            <>
              <div>
                <label className="label-field">Auteur</label>
                <input value={author} onChange={(e) => updateProject({ author: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label-field">Genre</label>
                <input value={genre ?? ''} onChange={(e) => updateProject({ genre: e.target.value })} className="input-field" placeholder="Fantasy, Science-Fiction, Thriller..." />
              </div>
            </>
          )}
          <div>
            <label className="label-field">Synopsis</label>
            <textarea value={synopsis ?? ''} onChange={(e) => updateProject({ synopsis: e.target.value })} className="textarea-field" rows={4} />
          </div>
        </div>
      </div>

      {/* Writing mode — only for standalone books */}
      {!saga && (
        <div className="card-fantasy p-6 mb-6">
          <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Mode d'écriture</h3>
          <p className="text-sm text-ink-300 mb-4">
            Vous pouvez changer de mode à tout moment. En cas de passage vers le mode Comptage, vos textes rédigés peuvent être conservés ou supprimés.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Count mode */}
            <button
              type="button"
              onClick={() => { if (writingMode !== 'count') setPendingMode('count'); }}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                writingMode === 'count'
                  ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200 cursor-default'
                  : 'border-parchment-200 hover:border-parchment-400 cursor-pointer'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                writingMode === 'count' ? 'bg-bordeaux-100' : 'bg-parchment-200'
              }`}>
                <Hash className={`w-5 h-5 ${writingMode === 'count' ? 'text-bordeaux-500' : 'text-ink-300'}`} />
              </div>
              <div>
                <p className="font-display font-semibold text-ink-500 text-sm">Comptage de mots</p>
                <p className="text-xs text-ink-300 mt-1 leading-relaxed">
                  Vous écrivez ailleurs et saisissez manuellement le nombre de mots par scène.
                </p>
                {writingMode === 'count' && (
                  <span className="inline-block mt-1.5 text-[10px] bg-bordeaux-100 text-bordeaux-600 px-1.5 py-0.5 rounded-full font-medium">
                    Mode actuel
                  </span>
                )}
              </div>
            </button>

            {/* Write mode */}
            <button
              type="button"
              onClick={() => { if (writingMode !== 'write') setPendingMode('write'); }}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                writingMode === 'write'
                  ? 'border-bordeaux-400 bg-bordeaux-50/50 ring-2 ring-bordeaux-200 cursor-default'
                  : 'border-parchment-200 hover:border-parchment-400 cursor-pointer'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                writingMode === 'write' ? 'bg-bordeaux-100' : 'bg-parchment-200'
              }`}>
                <PenLine className={`w-5 h-5 ${writingMode === 'write' ? 'text-bordeaux-500' : 'text-ink-300'}`} />
              </div>
              <div>
                <p className="font-display font-semibold text-ink-500 text-sm">Écriture intégrée</p>
                <p className="text-xs text-ink-300 mt-1 leading-relaxed">
                  Vous rédigez directement dans l'application. Le comptage est automatique.
                </p>
                {writingMode === 'write' && (
                  <span className="inline-block mt-1.5 text-[10px] bg-bordeaux-100 text-bordeaux-600 px-1.5 py-0.5 rounded-full font-medium">
                    Mode actuel
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Count unit — only for standalone books */}
      {!saga && (
        <div className="card-fantasy p-6 mb-6">
          <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Unité de comptage</h3>
          <p className="text-sm text-ink-300 mb-4">
            Choisissez si les objectifs et jauges sont basés sur les mots ou les signes (espaces compris). L'autre valeur sera affichée à titre informatif.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateCountUnit('words')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                countUnit === 'words'
                  ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                  : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
              }`}
            >
              Mots
            </button>
            <button
              type="button"
              onClick={() => updateCountUnit('characters')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                countUnit === 'characters'
                  ? 'border-bordeaux-400 bg-bordeaux-50/50 text-bordeaux-600 font-medium'
                  : 'border-parchment-200 text-ink-300 hover:border-parchment-400'
              }`}
            >
              Signes (espaces compris)
            </button>
          </div>
        </div>
      )}

      {/* Mise en page — only for standalone books */}
      {!saga && (
        <div className="card-fantasy p-6 mb-6">
          <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Mise en page</h3>
          <p className="text-sm text-ink-300 mb-4">
            Ces paramètres s'appliquent à l'éditeur, au mode relecture et aux exports (EPUB/PDF).
          </p>

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
      )}

      {/* Transform to saga — only for standalone books */}
      {!saga && (
        <div className="card-fantasy p-6 mb-6 border-bordeaux-100">
          <h3 className="font-display text-lg font-semibold text-ink-500 mb-1">Transformer en saga</h3>
          <p className="text-sm text-ink-300 mb-4">
            Créez une saga à partir de ce livre pour y ajouter d'autres tomes.
            L'encyclopédie (personnages, lieux, univers, cartes) sera partagée entre tous les livres de la saga.
          </p>
          <button
            onClick={() => setShowTransformSaga(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-bordeaux-200 text-bordeaux-500 text-sm font-medium hover:bg-bordeaux-50 transition-all"
          >
            <Library className="w-4 h-4" />
            Transformer en saga
          </button>
        </div>
      )}

      {/* Backup & sync */}
      <VersionHistorySection bookId={bookId} />

      {/* Layout info dialog */}
      {showLayoutInfo && <LayoutChangeInfoDialog onClose={() => setShowLayoutInfo(false)} />}

      {/* Writing mode change dialog */}
      {pendingMode && (
        <WritingModeChangeDialog
          fromMode={writingMode}
          toMode={pendingMode}
          onConfirm={(deleteContent) => {
            updateWritingMode(pendingMode, deleteContent);
            setPendingMode(null);
          }}
          onCancel={() => setPendingMode(null)}
        />
      )}

      {/* Transform to saga dialog */}
      {showTransformSaga && (
        <TransformToSagaDialog
          bookTitle={title}
          onConfirm={handleTransformToSaga}
          onCancel={() => setShowTransformSaga(false)}
        />
      )}
    </div>
  );
}
