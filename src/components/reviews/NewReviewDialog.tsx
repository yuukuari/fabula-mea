import { useState } from 'react';
import { X, ChevronDown, ChevronRight, Check, Mail, Copy, Link } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useReviewStore } from '@/store/useReviewStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { cn, isSpecialChapter, getChapterLabel } from '@/lib/utils';
import type { ReviewSession, Chapter, Scene } from '@/types';

interface Props {
  onClose: () => void;
  onCreated: (session: ReviewSession) => void;
  /** Called when multiple sessions are created (multi-email) */
  onMultiCreated?: (sessions: ReviewSession[]) => void;
}

export function NewReviewDialog({ onClose, onCreated, onMultiCreated }: Props) {
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const bookTitle = useBookStore((s) => s.title);
  const bookId = useLibraryStore((s) => s.currentBookId);
  const user = useAuthStore((s) => s.user);
  const createSession = useReviewStore((s) => s.createSession);

  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(chapters.map((c) => c.id)));
  const [readerEmails, setReaderEmails] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<'select' | 'share'>('select');
  const [createdSessions, setCreatedSessions] = useState<ReviewSession[]>([]);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);

  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);

  const toggleChapterExpand = (id: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleScene = (sceneId: string) => {
    setSelectedSceneIds((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const toggleChapter = (chapter: Chapter) => {
    const chapterSceneIds = chapter.sceneIds;
    const allSelected = chapterSceneIds.every((id) => selectedSceneIds.has(id));
    setSelectedSceneIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        chapterSceneIds.forEach((id) => next.delete(id));
      } else {
        chapterSceneIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = scenes.map((s) => s.id);
    setSelectedSceneIds(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedSceneIds(new Set());
  };

  const handleCreate = async () => {
    if (!bookId || !user || selectedSceneIds.size === 0) return;
    setIsCreating(true);

    try {
      // Build snapshot — copy selected scenes & their chapters
      const selectedScenes = scenes.filter((s) => selectedSceneIds.has(s.id));
      const chapterIds = new Set(selectedScenes.map((s) => s.chapterId));
      const selectedChapters = chapters
        .filter((c) => chapterIds.has(c.id))
        .map((c) => ({
          id: c.id,
          title: c.title,
          number: c.number,
          type: c.type,
          synopsis: c.synopsis,
          color: c.color,
          sceneIds: c.sceneIds.filter((sid) => selectedSceneIds.has(sid)),
        }));

      const snapshotScenes = selectedScenes.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        chapterId: s.chapterId,
        orderInChapter: s.orderInChapter,
        content: s.content,
        characterIds: s.characterIds,
        placeId: s.placeId,
      }));

      // Parse emails — support comma-separated list
      const emails = readerEmails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      const emailsToCreate = emails.length > 0 ? emails : [undefined];
      const results: ReviewSession[] = [];

      for (const email of emailsToCreate) {
        const session = await createSession({
          bookId,
          bookTitle: bookTitle || 'Sans titre',
          authorName: user.name,
          authorEmail: user.email,
          readerEmail: email,
          snapshot: {
            chapters: selectedChapters,
            scenes: snapshotScenes,
          },
        });
        results.push(session);
      }

      setCreatedSessions(results);
      setStep('share');
    } catch (e) {
      console.error('Failed to create review session:', e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/review/${token}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(token);
    setTimeout(() => setLinkCopied(null), 2000);
  };

  const handleDone = () => {
    if (createdSessions.length > 1 && onMultiCreated) {
      onMultiCreated(createdSessions);
    } else if (createdSessions.length === 1) {
      onCreated(createdSessions[0]);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-200">
          <h2 className="font-display text-xl font-bold text-ink-500">
            {step === 'select' ? 'Nouvelle demande de relecture' : 'Relecture créée !'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-parchment-100">
            <X className="w-5 h-5 text-ink-300" />
          </button>
        </div>

        {step === 'select' ? (
          <>
            {/* Scene selection */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-400 mb-2">
                  Sélectionnez les chapitres et scènes à partager
                </label>
                <div className="flex gap-2 mb-3">
                  <button onClick={selectAll} className="text-xs text-bordeaux-500 hover:underline">
                    Tout sélectionner
                  </button>
                  <span className="text-xs text-ink-200">·</span>
                  <button onClick={deselectAll} className="text-xs text-bordeaux-500 hover:underline">
                    Tout désélectionner
                  </button>
                  <span className="ml-auto text-xs text-ink-300">
                    {selectedSceneIds.size} scène{selectedSceneIds.size !== 1 ? 's' : ''} sélectionnée{selectedSceneIds.size !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="border border-parchment-200 rounded-lg max-h-64 overflow-y-auto">
                  {sortedChapters.map((chapter) => {
                    const chapterScenes = chapter.sceneIds
                      .map((sid) => scenes.find((s) => s.id === sid))
                      .filter(Boolean) as Scene[];
                    const isExpanded = expandedChapters.has(chapter.id);
                    const allSelected = chapterScenes.length > 0 && chapterScenes.every((s) => selectedSceneIds.has(s.id));
                    const someSelected = chapterScenes.some((s) => selectedSceneIds.has(s.id));
                    const isSpecial = isSpecialChapter(chapter);

                    // Hide special chapters that have no scenes
                    if (isSpecial && chapterScenes.length === 0) return null;

                    return (
                      <div key={chapter.id} className="border-b border-parchment-100 last:border-0">
                        <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-parchment-50">
                          <button
                            onClick={() => toggleChapterExpand(chapter.id)}
                            className="p-0.5"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-ink-300" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-ink-300" />
                            )}
                          </button>
                          <label className="flex items-center gap-2 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelected && !allSelected;
                              }}
                              onChange={() => toggleChapter(chapter)}
                              className="accent-bordeaux-500"
                            />
                            {!isSpecial && (
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: chapter.color }}
                              />
                            )}
                            <span className={cn('text-sm font-medium', isSpecial ? 'text-ink-300 italic' : 'text-ink-400')}>
                              {getChapterLabel(chapter)}
                            </span>
                            <span className="text-xs text-ink-200 ml-auto">
                              {chapterScenes.length} scène{chapterScenes.length !== 1 ? 's' : ''}
                            </span>
                          </label>
                        </div>

                        {isExpanded && chapterScenes.length > 0 && (
                          <div className="pl-10 pb-2 space-y-0.5">
                            {chapterScenes.map((scene) => (
                              <label
                                key={scene.id}
                                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-parchment-50 rounded"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSceneIds.has(scene.id)}
                                  onChange={() => toggleScene(scene.id)}
                                  className="accent-bordeaux-500"
                                />
                                <span className="text-sm text-ink-300">
                                  {scene.title || scene.description || 'Scène sans titre'}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reader email(s) (optional) */}
              <div>
                <label className="block text-sm font-medium text-ink-400 mb-1.5">
                  Email(s) du/des relecteur(s) <span className="text-ink-200 font-normal">(optionnel)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-ink-200 flex-shrink-0" />
                  <input
                    type="text"
                    value={readerEmails}
                    onChange={(e) => setReaderEmails(e.target.value)}
                    placeholder="email1@mail.com, email2@mail.com"
                    className="flex-1 px-3 py-2 text-sm border border-parchment-300 rounded-lg
                             focus:border-bordeaux-300 focus:ring-1 focus:ring-bordeaux-200 outline-none"
                  />
                </div>
                <p className="text-xs text-ink-200 mt-1">
                  Séparez les adresses par des virgules. Une session sera créée par relecteur.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-parchment-200">
              <button onClick={onClose} className="btn-ghost px-4 py-2">
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={selectedSceneIds.size === 0 || isCreating}
                className={cn(
                  'btn-primary flex items-center gap-2',
                  (selectedSceneIds.size === 0 || isCreating) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isCreating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
                Créer la relecture
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Share step */}
            <div className="flex-1 px-6 py-8 space-y-6 text-center overflow-y-auto">
              <div className="w-16 h-16 mx-auto bg-green-50 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>

              <div>
                <h3 className="font-display text-lg font-bold text-ink-500 mb-2">
                  {createdSessions.length > 1 ? `${createdSessions.length} relectures créées` : 'Relecture créée avec succès'}
                </h3>
                <p className="text-sm text-ink-300">
                  {createdSessions.some((s) => s.readerEmail)
                    ? `Un email d'invitation a été envoyé aux relecteurs.`
                    : 'Partagez le(s) lien(s) ci-dessous avec vos relecteurs.'}
                </p>
              </div>

              <div className="space-y-3">
                {createdSessions.map((session) => (
                  <div key={session.id} className="bg-parchment-50 rounded-lg p-3 border border-parchment-200">
                    {session.readerEmail && (
                      <p className="text-xs text-ink-300 mb-2 text-left">{session.readerEmail}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/review/${session.token}`}
                        className="flex-1 bg-transparent text-sm text-ink-400 outline-none truncate"
                      />
                      <button
                        onClick={() => handleCopyLink(session.token)}
                        className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-sm flex-shrink-0"
                      >
                        {linkCopied === session.token ? (
                          <><Check className="w-3.5 h-3.5" />Copié !</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" />Copier</>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end px-6 py-4 border-t border-parchment-200">
              <button onClick={handleDone} className="btn-primary px-6 py-2">
                Terminé
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
