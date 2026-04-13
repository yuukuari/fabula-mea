import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, ChevronDown, LogOut, ExternalLink, Music, Loader2, List, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  hasSpotifyConfig,
  getSpotifyAuthUrl,
  loadTokens,
  clearTokens,
  clearSelectedPlaylist,
  getPlaylists,
  loadSelectedPlaylist,
  saveSelectedPlaylist,
  type SpotifyPlaylist,
} from '@/lib/spotify';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';

// ─── Spotify Icon (SVG, lucide doesn't have it) ───

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

// ─── Component ───

export function FloatingSpotifyPlayer() {
  if (!hasSpotifyConfig) return null;

  return <SpotifyPlayerInner />;
}

function SpotifyPlayerInner() {
  const [expanded, setExpanded] = useState(false);
  const [isConnected, setIsConnected] = useState(() => !!loadTokens());
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(() => loadSelectedPlaylist());
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [view, setView] = useState<'player' | 'playlists'>('player');
  const [connectError, setConnectError] = useState<string | null>(null);

  const player = useSpotifyPlayer();

  // Listen for OAuth callback messages
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      console.log('[SpotifyPlayer] Received message:', event.origin, event.data);
      if (event.origin !== window.location.origin) {
        console.warn('[SpotifyPlayer] Origin mismatch:', event.origin, '!==', window.location.origin);
        return;
      }
      if (event.data?.type !== 'spotify-callback') return;

      console.log('[SpotifyPlayer] Spotify callback message:', event.data);

      if (event.data.error) {
        setConnectError('Connexion refusée ou échouée.');
        return;
      }

      if (event.data.accessToken) {
        setIsConnected(true);
        setConnectError(null);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Init player when connected
  useEffect(() => {
    if (isConnected && !player.isReady) {
      player.initPlayer();
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load playlists on connect
  const fetchPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      const lists = await getPlaylists();
      setPlaylists(lists);
      // Update selected playlist metadata (track count, image, etc.)
      setSelectedPlaylist((prev) => {
        if (!prev) return prev;
        const updated = lists.find((p) => p.id === prev.id);
        if (updated) {
          saveSelectedPlaylist(updated);
          return updated;
        }
        return prev;
      });
    } catch {
      // Token might be invalid
      setPlaylists([]);
    }
    setLoadingPlaylists(false);
  }, []);

  useEffect(() => {
    if (isConnected) fetchPlaylists();
  }, [isConnected, fetchPlaylists]);

  const handleConnect = async () => {
    setConnectError(null);
    try {
      const url = await getSpotifyAuthUrl();
      const w = 450;
      const h = 700;
      const left = window.screenX + (window.innerWidth - w) / 2;
      const top = window.screenY + (window.innerHeight - h) / 2;
      window.open(url, 'spotify-auth', `width=${w},height=${h},left=${left},top=${top}`);
    } catch {
      setConnectError('Impossible de lancer la connexion Spotify.');
    }
  };

  const handleDisconnect = () => {
    player.disconnect();
    clearTokens();
    clearSelectedPlaylist();
    setIsConnected(false);
    setSelectedPlaylist(null);
    setPlaylists([]);
    setView('player');
  };

  const handleSelectPlaylist = async (playlist: SpotifyPlaylist) => {
    setSelectedPlaylist(playlist);
    saveSelectedPlaylist(playlist);
    setView('player');
    if (player.isReady) {
      await player.play(playlist.uri);
    }
  };

  const handlePlayPause = async () => {
    if (!player.isReady) return;
    if (!player.isPlaying && !player.currentTrack && selectedPlaylist) {
      // First play
      await player.play(selectedPlaylist.uri);
    } else {
      await player.togglePlay();
    }
  };

  return (
    <div className="relative">
      {/* Expanded panel */}
      {expanded && (
        <div className="absolute bottom-full right-0 mb-2 bg-parchment-50 rounded-2xl shadow-xl border border-parchment-200 w-80 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-parchment-200">
            <span className="font-display font-semibold text-sm text-ink-500 flex items-center gap-1.5">
              <SpotifyIcon className="w-4 h-4 text-[#1DB954]" />
              Spotify
            </span>
            <div className="flex items-center gap-1">
              {isConnected && (
                <>
                  <button
                    onClick={() => setView(view === 'playlists' ? 'player' : 'playlists')}
                    className="p-1 rounded-lg hover:bg-parchment-200 text-ink-300"
                    title={view === 'playlists' ? 'Lecteur' : 'Playlists'}
                  >
                    {view === 'playlists' ? <Music className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="p-1 rounded-lg hover:bg-parchment-200 text-ink-300"
                    title="Déconnecter Spotify"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button onClick={() => setExpanded(false)} className="p-1 rounded-lg hover:bg-parchment-200 text-ink-300">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {!isConnected ? (
            <ConnectView onConnect={handleConnect} error={connectError} />
          ) : view === 'playlists' ? (
            <PlaylistsView
              playlists={playlists}
              loading={loadingPlaylists}
              selectedId={selectedPlaylist?.id ?? null}
              onSelect={handleSelectPlaylist}
              onRefresh={fetchPlaylists}
            />
          ) : (
            <PlayerView
              player={player}
              selectedPlaylist={selectedPlaylist}
              onPlayPause={handlePlayPause}
              onChangePlaylist={() => setView('playlists')}
            />
          )}
        </div>
      )}

      {/* Floating pill button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label="Spotify"
        className={cn(
          'group flex items-center gap-0 rounded-full shadow-lg transition-all border',
          'hover:shadow-xl active:scale-95 overflow-hidden',
          player.isPlaying
            ? 'bg-[#1DB954] text-white border-[#1DB954]'
            : 'bg-parchment-50 text-ink-500 border-parchment-300'
        )}
      >
        <div className="flex items-center justify-center w-10 h-10 shrink-0">
          <SpotifyIcon className="w-4 h-4" />
        </div>
        {/* Track name — slides in on hover */}
        {player.currentTrack && (
          <div className="overflow-hidden transition-all duration-300 ease-in-out max-w-0 group-hover:max-w-40 opacity-0 group-hover:opacity-100">
            <span className="text-xs font-medium whitespace-nowrap pr-3 truncate block max-w-40">
              {player.currentTrack.name}
            </span>
          </div>
        )}
      </button>
    </div>
  );
}

// ─── Sub-views ───

function ConnectView({ onConnect, error }: { onConnect: () => void; error: string | null }) {
  return (
    <div className="p-6 flex flex-col items-center gap-4">
      <SpotifyIcon className="w-10 h-10 text-[#1DB954]" />
      <p className="text-xs text-ink-300 text-center">
        Connectez votre compte Spotify pour écouter vos playlists pendant l'écriture.
      </p>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
      <button
        onClick={onConnect}
        className="px-4 py-2 rounded-full bg-[#1DB954] text-white text-sm font-medium hover:bg-[#1ed760] transition-colors"
      >
        Connecter Spotify
      </button>
      <p className="text-[10px] text-ink-200 text-center">
        Requiert un compte Spotify Premium pour la lecture en navigateur.
      </p>
    </div>
  );
}

function PlaylistsView({
  playlists,
  loading,
  selectedId,
  onSelect,
  onRefresh,
}: {
  playlists: SpotifyPlaylist[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (p: SpotifyPlaylist) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3 pb-2 flex gap-1.5">
        <a
          href="https://open.spotify.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ink-400 hover:bg-parchment-200 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> Ouvrir Spotify
        </a>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto px-2 py-1.5 rounded-lg text-xs text-ink-300 hover:bg-parchment-200 transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Actualiser'}
        </button>
      </div>

      {/* List */}
      <div className="max-h-60 overflow-y-auto px-1 pb-2">
        {loading && playlists.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-ink-200" />
          </div>
        ) : playlists.length === 0 ? (
          <p className="text-xs text-ink-200 text-center py-6">Aucune playlist trouvée.</p>
        ) : (
          playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors',
                p.id === selectedId
                  ? 'bg-[#1DB954]/10 text-ink-500'
                  : 'hover:bg-parchment-100 text-ink-400'
              )}
            >
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-parchment-200 flex items-center justify-center shrink-0">
                  <Music className="w-3.5 h-3.5 text-ink-200" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-ink-200">{p.trackCount} titre{p.trackCount !== 1 ? 's' : ''}</p>
              </div>
              {p.id === selectedId && (
                <SpotifyIcon className="w-3 h-3 text-[#1DB954] shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function PlayerView({
  player,
  selectedPlaylist,
  onPlayPause,
  onChangePlaylist,
}: {
  player: ReturnType<typeof useSpotifyPlayer>;
  selectedPlaylist: SpotifyPlaylist | null;
  onPlayPause: () => void;
  onChangePlaylist: () => void;
}) {
  return (
    <div className="p-4 flex flex-col items-center gap-3">
      {/* Error */}
      {player.error && (
        <div className="w-full px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{player.error}</span>
        </div>
      )}

      {/* Current track */}
      {player.currentTrack ? (
        <div className="flex items-center gap-3 w-full">
          {player.currentTrack.albumImageUrl ? (
            <img
              src={player.currentTrack.albumImageUrl}
              alt=""
              className="w-12 h-12 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-parchment-200 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5 text-ink-200" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-500 truncate">{player.currentTrack.name}</p>
            <p className="text-xs text-ink-300 truncate">{player.currentTrack.artist}</p>
          </div>
        </div>
      ) : selectedPlaylist ? (
        <div className="flex items-center gap-3 w-full">
          {selectedPlaylist.imageUrl ? (
            <img
              src={selectedPlaylist.imageUrl}
              alt=""
              className="w-12 h-12 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-parchment-200 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5 text-ink-200" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-500 truncate">{selectedPlaylist.name}</p>
            <p className="text-xs text-ink-300">{selectedPlaylist.trackCount} titre{selectedPlaylist.trackCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      ) : (
        <div className="py-4 text-center">
          <Music className="w-8 h-8 text-ink-200 mx-auto mb-2" />
          <p className="text-xs text-ink-300">Aucune playlist sélectionnée</p>
        </div>
      )}

      {/* Controls */}
      {(selectedPlaylist || player.currentTrack) && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => player.previousTrack()}
            className="w-9 h-9 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center transition-colors text-ink-400"
            title="Piste précédente"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onPlayPause}
            disabled={!player.isReady}
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center transition-colors text-white',
              player.isReady ? 'bg-[#1DB954] hover:bg-[#1ed760]' : 'bg-ink-200 cursor-not-allowed'
            )}
          >
            {player.isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          <button
            onClick={() => player.stop()}
            className="w-9 h-9 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center transition-colors text-ink-400"
            title="Arrêter"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => player.nextTrack()}
            className="w-9 h-9 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center transition-colors text-ink-400"
            title="Piste suivante"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Change playlist / waiting for player */}
      <div className="flex items-center gap-2 mt-1">
        {!player.isReady && !player.error && (
          <span className="text-[10px] text-ink-200 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Connexion au lecteur...
          </span>
        )}
        <button
          onClick={onChangePlaylist}
          className="text-[11px] text-ink-300 hover:text-ink-500 transition-colors"
        >
          Changer de playlist
        </button>
      </div>
    </div>
  );
}
