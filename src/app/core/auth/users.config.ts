// Demo access gate only — not real security. Generated with scripts/hash-password.mjs.
// Only salted PBKDF2-SHA256 hashes live here; plaintext credentials are in the git-ignored CREDENTIALS.md.
import { AppRole } from './roles';

export interface DemoAccount {
  username: string;
  role: AppRole;
  displayName: string;
  salt: string; // base64
  hash: string; // base64, 32 bytes
  iterations: number;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { username: 'admin', role: 'SuperAdmin', displayName: 'Demo Admin', salt: 'Fz352nu7zLdZCmETjaZ0kw==', hash: 'Mo3Jn1oGD8LQFRmEoBcjbky5X8WYczRps0RftWQWnHs=', iterations: 310000 },
  { username: 'viewer', role: 'Viewer', displayName: 'Demo Viewer', salt: '774LeSFF1s/MuffsVYKwBw==', hash: '4tp6J6fMJ0hGkVFmryutNwD7j27ll2HbK10KJzGlHBk=', iterations: 310000 },
];
