import { webcrypto } from 'node:crypto';

// Polyfill crypto for Node 18 (crypto.randomUUID is not global)
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}
