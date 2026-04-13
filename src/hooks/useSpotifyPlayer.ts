import { useState, useEffect, useRef, useCallback } from 'react';
import { getValidToken, type SpotifyTrack } from '@/lib/spotify';

// ─── Spotify Web Playback SDK types (minimal) ───

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener: (event: string) => void;
  togglePlay: () => Promise<void>;
  resume: () => Promise<void>;
  pause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  getCurrentState: () => Promise<SpotifyPlaybackState | null>;
}

interface SpotifyPlaybackState {
  paused: boolean;
  track_window: {
    current_track: {
      name: string;
      artists: Array<{ name: string }>;
      album: { images: Array<{ url: string }> };
    };
  };
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

// ─── Script loader ───

let sdkLoadPromise: Promise<void> | null = null;

function loadSpotifySDK(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load Spotify SDK'));
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve();
    };
  });

  return sdkLoadPromise;
}

// ─── Hook ───

export interface SpotifyPlayerAPI {
  isReady: boolean;
  isPlaying: boolean;
  currentTrack: SpotifyTrack | null;
  deviceId: string | null;
  error: string | null;
  initPlayer: () => Promise<void>;
  play: (playlistUri: string) => Promise<void>;
  togglePlay: () => Promise<void>;
  stop: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  disconnect: () => void;
}

export function useSpotifyPlayer(): SpotifyPlayerAPI {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<SpotifyPlayerInstance | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.disconnect();
    };
  }, []);

  const initPlayer = useCallback(async () => {
    try {
      setError(null);

      // Get a valid token BEFORE initializing the SDK
      const initialToken = await getValidToken();
      if (!initialToken) {
        setError('Pas de token Spotify disponible');
        return;
      }

      await loadSpotifySDK();

      if (!window.Spotify) {
        setError('Spotify SDK not available');
        return;
      }

      // Disconnect existing player
      if (playerRef.current) {
        playerRef.current.disconnect();
      }

      const player = new window.Spotify.Player({
        name: 'Fabula Mea',
        getOAuthToken: (cb) => {
          // Synchronous path: use the token we already have
          // For refreshes, go async
          getValidToken().then((token) => {
            if (token) cb(token);
          });
        },
        volume: 0.5,
      });

      player.addListener('ready', async (data: unknown) => {
        const { device_id: sdkDeviceId } = data as { device_id: string };

        // The SDK device_id doesn't always match the one registered in Spotify's backend.
        // Query the devices API to find the real ID by name.
        let realDeviceId = sdkDeviceId;
        const t = await getValidToken();
        if (t) {
          const resp = await fetch('https://api.spotify.com/v1/me/player/devices', {
            headers: { Authorization: `Bearer ${t}` },
          });
          if (resp.ok) {
            const { devices } = await resp.json() as { devices: Array<{ id: string; name: string }> };
            const ours = devices.find((d) => d.name === 'Fabula Mea');
            if (ours) realDeviceId = ours.id;
          }
        }

        setDeviceId(realDeviceId);
        setIsReady(true);
      });

      player.addListener('not_ready', () => {
        setIsReady(false);
        setDeviceId(null);
      });

      player.addListener('player_state_changed', (state: unknown) => {
        if (!state) {
          setIsPlaying(false);
          setCurrentTrack(null);
          return;
        }
        const s = state as SpotifyPlaybackState;
        setIsPlaying(!s.paused);
        const track = s.track_window.current_track;
        setCurrentTrack({
          name: track.name,
          artist: track.artists.map((a) => a.name).join(', '),
          albumImageUrl: track.album.images?.[0]?.url ?? null,
        });
      });

      player.addListener('initialization_error', (e: unknown) => {
        setError((e as { message: string }).message);
      });

      player.addListener('authentication_error', (e: unknown) => {
        setError((e as { message: string }).message);
      });

      player.addListener('account_error', () => {
        setError('Spotify Premium est requis pour la lecture en navigateur.');
      });

      const connected = await player.connect();
      if (!connected) {
        setError('Impossible de se connecter au lecteur Spotify');
      }

      playerRef.current = player;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }, []);

  const play = useCallback(async (playlistUri: string) => {
    if (!deviceId) return;
    const token = await getValidToken();
    if (!token) return;

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Retry loop — Spotify's backend can take a few seconds to register a new SDK device
    for (let attempt = 0; attempt < 5; attempt++) {
      const resp = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        { method: 'PUT', headers, body: JSON.stringify({ context_uri: playlistUri }) },
      );

      if (resp.ok || resp.status === 204) return; // success

      if (resp.status === 404 && attempt < 4) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      return;
    }
  }, [deviceId]);

  const togglePlay = useCallback(async () => {
    if (!playerRef.current) return;
    await playerRef.current.togglePlay();
  }, []);

  const stop = useCallback(async () => {
    if (!playerRef.current) return;
    await playerRef.current.pause();
    setIsPlaying(false);
  }, []);

  const nextTrack = useCallback(async () => {
    if (!playerRef.current) return;
    await playerRef.current.nextTrack();
  }, []);

  const previousTrack = useCallback(async () => {
    if (!playerRef.current) return;
    await playerRef.current.previousTrack();
  }, []);

  const disconnect = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTrack(null);
    setDeviceId(null);
  }, []);

  return {
    isReady,
    isPlaying,
    currentTrack,
    deviceId,
    error,
    initPlayer,
    play,
    togglePlay,
    stop,
    nextTrack,
    previousTrack,
    disconnect,
  };
}
