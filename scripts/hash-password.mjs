// Usage: npm run hash-password -- "<password>"
// Prints a PBKDF2-SHA256 (310000 iterations) salt + hash for src/app/core/auth/users.config.ts
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "<password>"');
  process.exit(1);
}
const iterations = 310000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
console.log(JSON.stringify({ iterations, salt: salt.toString('base64'), hash: hash.toString('base64') }, null, 2));
