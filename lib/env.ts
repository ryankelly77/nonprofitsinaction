/*
 * Settings read from the environment. See .env.local.example for what each
 * one is and where its value comes from.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nonprofitsinaction.org').replace(/\/$/, '');

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True once the Supabase project's URL and public key are set. */
export function hasSupabase(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/*
 * Without Supabase settings a local build or `npm run check` still completes:
 * the public pages render with no events. A production deployment must never
 * do that quietly (it would cache empty pages), so there it is an error.
 */
export function requireSupabaseInProduction(): void {
  if (!hasSupabase() && process.env.VERCEL_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in production.');
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
