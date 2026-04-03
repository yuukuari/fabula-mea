import { useEffect, useState } from 'react';
import {
  Plus, Trash2, Pencil, X, Save, Bug, Sparkles, Zap, Tag, ArrowLeft, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useReleaseStore } from '@/store/useReleaseStore';
import { useTicketStore } from '@/store/useTicketStore';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { Release, ReleaseStatus, ReleaseItem, ReleaseItemType } from '@/types';

const STATUS_OPTIONS: { value: ReleaseStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Brouillon', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'planned', label: 'Planifiée', color: 'bg-blue-100 text-blue-600' },
  { value: 'current', label: 'Actuelle', color: 'bg-green-100 text-green-700' },
  { value: 'released', label: 'Publiée', color: 'bg-gray-100 text-gray-500' },
];

const ITEM_TYPES: { value: ReleaseItemType; label: string; icon: typeof Bug }[] = [
  { value: 'bugfix', label: 'Correction', icon: Bug },
  { value: 'improvement', label: 'Amélioration', icon: Sparkles },
  { value: 'feature', label: 'Nouveauté', icon: Zap },
];

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function AdminReleasesPage() {
  const navigate = useNavigate();
  const { releases, loadReleases, createRelease, updateRelease, deleteRelease, isLoading } = useReleaseStore();
  const { tickets, loadTickets } = useTicketStore();
  const [editingRelease, setEditingRelease] = useState<Partial<Release> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadReleases();
    loadTickets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...releases].sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true })
  );

  const handleNew = () => {
    setEditingRelease({
      version: '',
      title: '',
      description: '',
      status: 'draft',
      items: [],
      ticketIds: [],
    });
    setIsNew(true);
  };

  const handleEdit = (release: Release) => {
    setEditingRelease({ ...release, items: [...release.items] });
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editingRelease?.version?.trim()) return;
    if (isNew) {
      await createRelease({
        version: editingRelease.version!,
        title: editingRelease.title ?? '',
        description: editingRelease.description ?? '',
        status: editingRelease.status as ReleaseStatus ?? 'planned',
        items: (editingRelease.items ?? []) as ReleaseItem[],
        ticketIds: editingRelease.ticketIds ?? [],
        releasedAt: editingRelease.status === 'released' || editingRelease.status === 'current'
          ? new Date().toISOString()
          : undefined,
      });
    } else {
      await updateRelease(editingRelease.id!, {
        ...editingRelease,
        releasedAt: (editingRelease.status === 'released' || editingRelease.status === 'current')
          && !editingRelease.releasedAt
          ? new Date().toISOString()
          : editingRelease.releasedAt,
      } as Partial<Release>);
    }
    setEditingRelease(null);
  };

  const handleDelete = async () => {
    if (confirmDeleteId) {
      await deleteRelease(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const addItem = () => {
    if (!editingRelease) return;
    const items = [...(editingRelease.items ?? [])];
    items.push({ id: generateId(), type: 'improvement', description: '' });
    setEditingRelease({ ...editingRelease, items });
  };

  const updateItem = (index: number, updates: Partial<ReleaseItem>) => {
    if (!editingRelease) return;
    const items = [...(editingRelease.items ?? [])] as ReleaseItem[];
    items[index] = { ...items[index], ...updates };
    setEditingRelease({ ...editingRelease, items });
  };

  const removeItem = (index: number) => {
    if (!editingRelease) return;
    const items = (editingRelease.items ?? []).filter((_, i) => i !== index);
    setEditingRelease({ ...editingRelease, items });
  };

  // Get tickets linked to a release
  const getLinkedTickets = (releaseId: string) =>
    tickets.filter((t) => t.releaseId === releaseId);

  const selectedRelease = selectedId ? releases.find((r) => r.id === selectedId) : null;

  const renderEditorModal = () => {
    if (!editingRelease) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={() => setEditingRelease(null)} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-display font-bold text-ink-500">
              {isNew ? 'Nouvelle version' : `Modifier la version ${editingRelease.version}`}
            </h2>
            <button onClick={() => setEditingRelease(null)} className="p-1.5 rounded-lg text-ink-300 hover:bg-parchment-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Version *</label>
                <input
                  type="text"
                  value={editingRelease.version ?? ''}
                  onChange={(e) => setEditingRelease({ ...editingRelease, version: e.target.value })}
                  placeholder="1.2.0"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Statut</label>
                <select
                  value={editingRelease.status ?? 'planned'}
                  onChange={(e) => setEditingRelease({ ...editingRelease, status: e.target.value as ReleaseStatus })}
                  className="input-field"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label-field">Titre</label>
              <input
                type="text"
                value={editingRelease.title ?? ''}
                onChange={(e) => setEditingRelease({ ...editingRelease, title: e.target.value })}
                placeholder="Optionnel — nom de la version..."
                className="input-field"
              />
            </div>

            <div>
              <label className="label-field">Description</label>
              <textarea
                value={editingRelease.description ?? ''}
                onChange={(e) => setEditingRelease({ ...editingRelease, description: e.target.value })}
                placeholder="Description générale de la version..."
                className="textarea-field"
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-field mb-0">Éléments</label>
                <button onClick={addItem} className="text-xs btn-ghost text-bordeaux-500 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {(editingRelease.items as ReleaseItem[] ?? []).map((item, i) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <select
                      value={item.type}
                      onChange={(e) => updateItem(i, { type: e.target.value as ReleaseItemType })}
                      className="text-sm border border-parchment-300 rounded px-2 py-1.5 bg-white w-36"
                    >
                      {ITEM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      placeholder="Description..."
                      className="input-field flex-1 text-sm"
                    />
                    <button
                      onClick={() => removeItem(i)}
                      className="p-1.5 rounded text-ink-200 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {(editingRelease.items ?? []).length === 0 && (
                  <p className="text-xs text-ink-200 py-2">Aucun élément ajouté</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-parchment-200">
              <button onClick={() => setEditingRelease(null)} className="btn-secondary">
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!editingRelease.version?.trim()}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isNew ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Detail view for a selected release
  if (selectedRelease) {
    const statusConf = STATUS_OPTIONS.find((s) => s.value === selectedRelease.status)!;
    const linkedTickets = getLinkedTickets(selectedRelease.id);

    return (
      <div className="page-container max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setSelectedId(null)} className="btn-ghost p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button onClick={() => handleEdit(selectedRelease)} className="btn-secondary flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Modifier
          </button>
          <button onClick={() => setConfirmDeleteId(selectedRelease.id)} className="btn-ghost text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="card-fantasy p-6">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h2 className="font-display text-3xl font-bold text-ink-500">Version {selectedRelease.version}</h2>
            <span className={cn('badge', statusConf.color)}>{statusConf.label}</span>
          </div>
          {selectedRelease.title && (
            <p className="text-lg text-ink-400 mb-2">{selectedRelease.title}</p>
          )}
          {selectedRelease.releasedAt && (
            <p className="text-sm text-ink-200 mb-4">
              Publiée le {new Date(selectedRelease.releasedAt).toLocaleDateString('fr-FR')}
            </p>
          )}
          {selectedRelease.description && (
            <p className="text-ink-300 font-serif whitespace-pre-wrap mb-4">{selectedRelease.description}</p>
          )}

          {selectedRelease.items.length > 0 && (
            <div className="mb-4">
              <h4 className="font-display font-semibold text-ink-400 mb-2">Éléments</h4>
              <div className="space-y-2">
                {selectedRelease.items.map((item) => {
                  const typeConf = ITEM_TYPES.find((t) => t.value === item.type)!;
                  const Icon = typeConf.icon;
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-sm text-ink-400">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {linkedTickets.length > 0 && (
            <div className="pt-4 border-t border-parchment-200">
              <h4 className="font-display font-semibold text-ink-400 mb-2">Tickets associés</h4>
              <div className="space-y-1">
                {linkedTickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate('/tickets')}
                    className="flex items-center gap-1.5 text-sm text-bordeaux-500 hover:text-bordeaux-700 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {t.title} <span className="text-ink-200">(par {t.userName})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {renderEditorModal()}
        <ConfirmDialog
          open={confirmDeleteId !== null}
          title="Supprimer la version ?"
          description="Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={() => { handleDelete(); setSelectedId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title flex items-center gap-3">
          <Tag className="w-7 h-7 text-bordeaux-500" />
          Versions
        </h1>
        <button onClick={handleNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle version
        </button>
      </div>

      {renderEditorModal()}

      {/* Release list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-ink-200">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucune version pour le moment</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((release) => {
            const statusConf = STATUS_OPTIONS.find((s) => s.value === release.status)!;
            const linkedTickets = getLinkedTickets(release.id);

            return (
              <div key={release.id} onClick={() => setSelectedId(release.id)} className="card-fantasy p-4 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-bold text-ink-500">Version {release.version}</span>
                      <span className={cn('badge text-[10px]', statusConf.color)}>{statusConf.label}</span>
                    </div>
                    {release.title && <p className="text-sm text-ink-400">{release.title}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-ink-200">
                      <span>{release.items.length} éléments</span>
                      {linkedTickets.length > 0 && (
                        <span>{linkedTickets.length} ticket{linkedTickets.length > 1 ? 's' : ''} lié{linkedTickets.length > 1 ? 's' : ''}</span>
                      )}
                      {release.releasedAt && (
                        <span>
                          Publiée le {new Date(release.releasedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Supprimer la version ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
