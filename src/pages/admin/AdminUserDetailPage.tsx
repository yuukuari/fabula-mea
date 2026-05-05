import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, RotateCcw, Mail, Calendar, BookOpen, ShieldCheck } from 'lucide-react';
import { api, type AdminUserDetail } from '@/lib/api';
import { AI_FEATURES, defaultAiLimits } from '@/lib/ai';
import { AiUsageRecap } from '@/components/ai/AiUsageRecap';
import type { AiFeatureId, AiLimits } from '@/types';

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Limits draft (per-feature, weekly)
  const [perWeek, setPerWeek] = useState<Record<AiFeatureId, number>>(() => ({ character_image: 0 }));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    api.admin.getUserDetail(id)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        const draft: Record<AiFeatureId, number> = { character_image: 0 };
        for (const f of Object.keys(AI_FEATURES) as AiFeatureId[]) {
          draft[f] = d.usage.limits.perWeek[f] ?? AI_FEATURES[f].defaultLimit;
        }
        setPerWeek(draft);
      })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSavedMsg('');
    try {
      const limits: AiLimits = { perWeek };
      await api.admin.setAiLimits(id, limits);
      setSavedMsg('Limites enregistrées');
      setTimeout(() => setSavedMsg(''), 3000);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setSavedMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!id) return;
    setSaving(true);
    setSavedMsg('');
    try {
      await api.admin.setAiLimits(id, null);
      setSavedMsg('Limites par défaut restaurées');
      setTimeout(() => setSavedMsg(''), 3000);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setSavedMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-bordeaux-400" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="page-container">
        <button onClick={() => navigate('/admin/members')} className="btn-ghost flex items-center gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="text-red-500">{error || 'Utilisateur introuvable'}</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <button onClick={() => navigate('/admin/members')} className="btn-ghost flex items-center gap-2 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Membres
      </button>

      <div className="card-fantasy p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-bordeaux-500 text-white font-bold flex items-center justify-center text-lg shrink-0">
            {detail.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold text-ink-500">{detail.user.name}</h1>
              {detail.user.isAdmin && (
                <span className="badge bg-bordeaux-100 text-bordeaux-600">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-ink-300 mt-2 flex-wrap">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {detail.user.email}</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Inscrit le {new Date(detail.user.createdAt).toLocaleDateString('fr-FR')}
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {detail.booksCount} livre{detail.booksCount > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card-fantasy p-6 mb-6">
        <h2 className="font-display text-lg font-semibold text-ink-500 mb-1">Formule</h2>
        <p className="text-sm text-ink-300">Gratuit</p>
      </div>

      <div className="card-fantasy p-6 mb-6">
        <h2 className="font-display text-lg font-semibold text-ink-500 mb-4">Usage IA en cours</h2>
        <AiUsageRecap initialSummary={detail.usage} refreshKey={refreshKey} />
      </div>

      <div className="card-fantasy p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-500">Limites IA</h2>
            <p className="text-sm text-ink-300">
              Quota par feature, sur fenêtre glissante de 7&nbsp;jours.
              {detail.usage.hasOverride
                ? ' Limites personnalisées appliquées.'
                : ' Aucune personnalisation : limites par défaut.'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {(Object.keys(AI_FEATURES) as AiFeatureId[]).map((f) => {
            const def = AI_FEATURES[f];
            const isDefault = (defaultAiLimits().perWeek[f] ?? 0) === perWeek[f];
            return (
              <div key={f} className="flex items-center gap-3 bg-parchment-100 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-500">{def.label}</p>
                  <p className="text-xs text-ink-200">{def.description}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  className="input-field w-24 text-right"
                  value={perWeek[f]}
                  onChange={(e) => setPerWeek((prev) => ({ ...prev, [f]: Math.max(0, Number.parseInt(e.target.value, 10) || 0) }))}
                />
                <span className="text-xs text-ink-200 w-16 shrink-0">/ semaine{isDefault ? ' (déf.)' : ''}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
          {detail.usage.hasOverride && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurer les défauts
            </button>
          )}
          {savedMsg && (
            <span className={`text-sm ${savedMsg.includes('enregistr') || savedMsg.includes('défaut') ? 'text-green-600' : 'text-red-500'}`}>
              {savedMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
