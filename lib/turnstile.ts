import 'server-only';

/*
 * Cloudflare Turnstile, the check that a form was filled in by a person.
 * Without TURNSTILE_SECRET_KEY it is skipped (local work, previews); the
 * honeypot field and the minimum fill time in lib/submission.ts still apply.
 */
export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, cache: 'no-store' });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
