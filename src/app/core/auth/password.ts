import { DEMO_ACCOUNTS, DemoAccount } from './users.config';

const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2Sha256(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Verifies credentials against the salted PBKDF2-SHA256 hashes. Always derives once to even out timing. */
export async function verifyCredentials(username: string, password: string): Promise<DemoAccount | null> {
  const account = DEMO_ACCOUNTS.find((a) => a.username === username.trim().toLowerCase());
  const target = account ?? DEMO_ACCOUNTS[0];
  const derived = await pbkdf2Sha256(password, fromB64(target.salt), target.iterations);
  const match = constantTimeEqual(derived, fromB64(target.hash));
  return account && match ? account : null;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%*?';

/** Cryptographically random temporary password (rejection sampling, no modulo bias). */
export function generateTempPassword(length = 14): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of buf) {
      if (b < limit && out.length < length) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join('');
}
