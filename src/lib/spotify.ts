// ─── Spotify OAuth 2.0 PKCE + API Client ───

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
// Spotify requires loopback IPs (not "localhost") for local dev since April 2025
const REDIRECT_URI = (() => {
  const { protocol, hostname, port } = window.location;
  // Replace "localhost" with 127.0.0.1 for Spotify compliance
  const host = hostname === 'localhost' ? '127.0.0.1' : hostname;
  return `${protocol}//${host}${port ? `:${port}` : ''}/spotify-callback`;
})();
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'playlist-read-private',
].join(' ');

const STORAGE_KEY = 'fabula-mea-spotify';
// Use localStorage (not sessionStorage) because the OAuth callback opens in a popup
// which does NOT share sessionStorage with the opener window.
const VERIFIER_KEY = 'fabula-mea-spotify-verifier';

export const hasSpotifyConfig = !!CLIENT_ID;

// ─── Types ───

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp ms
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  imageUrl: string | null;
  trackCount: number;
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  albumImageUrl: string | null;
}

// ─── PKCE Helpers ───

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await sha256(verifier);
  return base64urlEncode(digest);
}

// ─── Auth ───

export async function getSpotifyAuthUrl(): Promise<string> {
  if (!CLIENT_ID) throw new Error('VITE_SPOTIFY_CLIENT_ID is not configured');

  const verifier = generateRandomString(64);
  localStorage.setItem(VERIFIER_KEY, verifier);

  const challenge = await generateCodeChallenge(verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokens> {
  if (!CLIENT_ID) throw new Error('VITE_SPOTIFY_CLIENT_ID is not configured');

  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('No code verifier found');
  localStorage.removeItem(VERIFIER_KEY);

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await resp.json();
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  if (!CLIENT_ID) throw new Error('VITE_SPOTIFY_CLIENT_ID is not configured');

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!resp.ok) {
    // Refresh token is invalid → disconnect
    clearTokens();
    throw new Error('Refresh token expired');
  }

  const data = await resp.json();
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

// ─── Token Persistence ───

export function saveTokens(tokens: SpotifyTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function loadTokens(): SpotifyTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SpotifyTokens;
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Get a valid access token, refreshing if expired */
export async function getValidToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;

  // Refresh 60s before expiry
  if (Date.now() > tokens.expiresAt - 60_000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      return refreshed.accessToken;
    } catch {
      return null;
    }
  }

  return tokens.accessToken;
}

// ─── API Helpers ───

async function spotifyFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = await getValidToken();
  if (!token) throw new Error('Not authenticated with Spotify');

  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (resp.status === 204) return undefined as T;

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Spotify API error ${resp.status}: ${err}`);
  }

  return resp.json();
}

// ─── Playlist API ───

export async function getPlaylists(): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<{
    items: Array<{
      id: string;
      name: string;
      uri: string;
      images: Array<{ url: string }> | null;
      tracks?: { total: number };
      items?: { total: number };
    }>;
  }>('https://api.spotify.com/v1/me/playlists?limit=50');

  return data.items.map((p) => ({
    id: p.id,
    name: p.name,
    uri: p.uri,
    imageUrl: p.images?.[0]?.url ?? null,
    trackCount: p.tracks?.total ?? p.items?.total ?? 0,
  }));
}

// ─── Selected Playlist Persistence ───

const PLAYLIST_KEY = 'fabula-mea-spotify-playlist';

export function saveSelectedPlaylist(playlist: SpotifyPlaylist): void {
  localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlist));
}

export function loadSelectedPlaylist(): SpotifyPlaylist | null {
  try {
    const raw = localStorage.getItem(PLAYLIST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SpotifyPlaylist;
  } catch {
    return null;
  }
}

export function clearSelectedPlaylist(): void {
  localStorage.removeItem(PLAYLIST_KEY);
}
