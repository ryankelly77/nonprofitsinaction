import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';

/*
 * The service role: every write on this site goes through here, on the
 * server, after the server has checked it. It bypasses row level security, so
 * it must never reach the browser ('server-only' makes importing it from a
 * client component a build error).
 */
export function serviceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: 'no-store' }) }
  });
}
