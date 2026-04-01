/**
 * Dev-mode auth — localStorage-based mock for /api/auth/* endpoints.
 *
 * Stores users in localStorage so you can create accounts, log in, switch
 * between accounts, and list all users — all without a backend.
 *
 * Keys used:
 *   emlb-dev-users   → Record<id, User>  (all user objects)
 *   emlb-dev-emails  → Record<email, id> (email → userId index)
 */

import bcrypt from 'bcryptjs';
import type { AuthUser } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: string;
}

// ─── LocalStorage helpers ────────────────────────────────────────────────────

const USERS_KEY = 'emlb-dev-users';
const EMAILS_KEY = 'emlb-dev-emails';

function getUsers(): Record<string, StoredUser> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function getEmails(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(EMAILS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, StoredUser>): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function saveEmails(emails: Record<string, string>): void {
  localStorage.setItem(EMAILS_KEY, JSON.stringify(emails));
}

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

// ─── Token helpers (simple base64, no real JWT needed in dev) ─────────────

function encodeToken(payload: { userId: string; email: string }): string {
  return `dev-${btoa(JSON.stringify(payload))}`;
}

function decodeToken(token: string): { userId: string; email: string } | null {
  if (!token.startsWith('dev-')) return null;
  try {
    return JSON.parse(atob(token.slice(4)));
  } catch {
    return null;
  }
}

// ─── Public API (same shape as the real serverless functions) ─────────────

export const devAuth = {
  async signup(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<{ token: string; user: AuthUser }> {
    const { email, password, name } = data;

    if (!email || !password) throw new Error('Email et mot de passe requis');
    if (password.length < 8) throw new Error('Mot de passe trop court (min. 8 caractères)');

    const normalized = email.toLowerCase().trim();
    const emails = getEmails();

    if (emails[normalized]) {
      throw new Error('Cet email est déjà utilisé');
    }

    const id = generateId();
    const passwordHash = await bcrypt.hash(password, 10);
    const user: StoredUser = {
      id,
      email: normalized,
      name: name?.trim() || normalized.split('@')[0],
      passwordHash,
      isAdmin: false,
      createdAt: new Date().toISOString(),
    };

    const users = getUsers();
    users[id] = user;
    emails[normalized] = id;

    saveUsers(users);
    saveEmails(emails);

    const token = encodeToken({ userId: id, email: normalized });
    return { token, user: { id, email: normalized, name: user.name, isAdmin: user.isAdmin } };
  },

  async login(data: {
    email: string;
    password: string;
  }): Promise<{ token: string; user: AuthUser }> {
    const { email, password } = data;

    if (!email || !password) throw new Error('Email et mot de passe requis');

    const normalized = email.toLowerCase().trim();
    const emails = getEmails();
    const userId = emails[normalized];

    if (!userId) throw new Error('Email ou mot de passe incorrect');

    const users = getUsers();
    const user = users[userId];
    if (!user) throw new Error('Email ou mot de passe incorrect');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Email ou mot de passe incorrect');

    const token = encodeToken({ userId: user.id, email: normalized });
    return { token, user: { id: user.id, email: normalized, name: user.name, isAdmin: user.isAdmin ?? false } };
  },

  async me(): Promise<AuthUser> {
    const token = localStorage.getItem('emlb-token');
    if (!token) throw new Error('Non authentifié');

    const payload = decodeToken(token);
    if (!payload) throw new Error('Token invalide');

    const users = getUsers();
    const user = users[payload.userId];
    if (!user) throw new Error('Utilisateur introuvable');

    return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin ?? false };
  },

  // ─── Bonus: list all local dev accounts ──────────────────────────────────

  listUsers(): Array<{ id: string; email: string; name: string; isAdmin: boolean; createdAt: string }> {
    const users = getUsers();
    return Object.values(users).map(({ id, email, name, isAdmin, createdAt }) => ({
      id,
      email,
      name,
      isAdmin: isAdmin ?? false,
      createdAt,
    }));
  },

  setAdmin(userId: string, isAdmin: boolean): void {
    const users = getUsers();
    if (users[userId]) {
      users[userId].isAdmin = isAdmin;
      saveUsers(users);
    }
  },

  async requestPasswordReset(email: string): Promise<{ ok: boolean }> {
    const normalized = email.toLowerCase().trim();
    const emails = getEmails();
    const userId = emails[normalized];

    if (userId) {
      const token = generateId();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      localStorage.setItem(`emlb-dev:reset-token:${token}`, JSON.stringify({ userId, email: normalized, expiresAt }));
      console.group('📧 [DEV] Email — Réinitialisation du mot de passe');
      console.log(`   To:      ${normalized}`);
      console.log(`   Subject: Réinitialisation de votre mot de passe — Fabula Mea`);
      console.log(`   Lien:    http://localhost:5174/reset-password/${token}`);
      console.log('   (email non envoyé en mode développement)');
      console.groupEnd();
    }

    return { ok: true };
  },

  async resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
    if (password.length < 8) throw new Error('Mot de passe trop court (min. 8 caractères)');

    const raw = localStorage.getItem(`emlb-dev:reset-token:${token}`);
    if (!raw) throw new Error('Lien invalide ou expiré');

    const { userId, expiresAt } = JSON.parse(raw) as { userId: string; email: string; expiresAt: string };
    if (new Date() > new Date(expiresAt)) {
      localStorage.removeItem(`emlb-dev:reset-token:${token}`);
      throw new Error('Lien invalide ou expiré');
    }

    const users = getUsers();
    if (!users[userId]) throw new Error('Utilisateur introuvable');

    users[userId].passwordHash = await bcrypt.hash(password, 10);
    saveUsers(users);
    localStorage.removeItem(`emlb-dev:reset-token:${token}`);

    return { ok: true };
  },
};
