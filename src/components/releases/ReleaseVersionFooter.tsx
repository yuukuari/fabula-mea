import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReleaseStore } from '@/store/useReleaseStore';

export function ReleaseVersionFooter() {
  const { releases, loadReleases, getCurrentRelease } = useReleaseStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (releases.length === 0) loadReleases();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = getCurrentRelease();
  if (!current) return null;

  return (
    <button
      onClick={() => navigate('/releases')}
      className="fixed bottom-2 right-2 z-30 text-[10px] text-ink-200 hover:text-bordeaux-400 transition-colors px-2 py-0.5 rounded bg-parchment-50/80 backdrop-blur-sm"
      title="Voir les notes de version"
    >
      v{current.version}
    </button>
  );
}
