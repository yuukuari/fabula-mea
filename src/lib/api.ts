/**
 * Client API — toutes les requêtes vers les Vercel serverless functions (/api/*).
 * Le token JWT est stocké dans localStorage sous la clé 'emlb-token'.
 * Les credentials Redis ne sont JAMAIS exposés au client — tout passe par le serveur.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

function getToken(): string | null {
  return localStorage.getItem('emlb-token');
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    signup: (data: { email: string; password: string; name?: string }) =>
      apiFetch<{ token: string; user: AuthUser }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => apiFetch<AuthUser>('/auth/me'),
  },

  library: {
    get: () => apiFetch<unknown[]>('/library'),
    save: (books: unknown[]) =>
      apiFetch<{ ok: boolean }>('/library', {
        method: 'POST',
        body: JSON.stringify(books),
      }),
  },

  books: {
    get: (bookId: string) => apiFetch<unknown>(`/book/${bookId}`),
    save: (bookId: string, data: unknown) =>
      apiFetch<{ ok: boolean }>(`/book/${bookId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (bookId: string) =>
      apiFetch<{ ok: boolean }>(`/book/${bookId}`, { method: 'DELETE' }),
    migrate: (data: { library: unknown[]; books: { id: string; data: unknown }[] }) =>
      apiFetch<{ ok: boolean; migrated: number }>('/migrate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
