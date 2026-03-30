import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReleaseStore } from '@/store/useReleaseStore';

/**
 * Small inline version badge (e.g. "v1.2.0") to be placed next to logos.
 * Clicking it navigates to the release notes page.
 */
export function VersionBadge() {
  const { releases, loadReleases, getCurrentRelease } = useReleaseStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (releases.length === 0) loadReleases();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = getCurrentRelease();
  if (!current) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigate('/releases');
      }}
      className="text-[10px] text-ink-200 hover:text-bordeaux-400 transition-colors px-1.5 py-0.5 rounded bg-parchment-100 border border-parchment-200 hover:border-bordeaux-200"
      title="Voir les notes de version"
    >
      v{current.version}
    </button>
  );
}
