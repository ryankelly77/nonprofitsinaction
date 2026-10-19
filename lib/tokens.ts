import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/*
 * The private edit link a submitter receives. The link carries 32 random
 * bytes; the database keeps only their SHA-256, so neither a database read nor
 * a backup yields a working link. Losing the email means asking an admin,
 * which is the same as EventON today.
 */
export function newManageToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
