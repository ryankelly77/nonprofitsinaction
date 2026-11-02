import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase, requireSupabaseInProduction } from '@/lib/env';

/*
 * The public, read-only view of the database: the anon key, so row level
 * security decides what it sees (approved events and what they point to).
 *
 * Two flavors, and the difference matters:
 *
 *  - cached (the default) is for the public pages. They are rendered ahead of
 *    time and refreshed every few minutes, or at once when an admin changes
 *    something (revalidatePath in lib/revalidate.ts). Their reads must use
 *    Next's ordinary fetch so the page can be cached at all.
 *
 *  - fresh is for anything answered per request: the date check in the
 *    submit form, the month view's API. These reads opt out of every cache
 *    (cache: 'no-store'). A database read is not a document; caching one by
 *    URL serves stale answers, which pear-portal learned the hard way.
 */
export function publicClient(mode: 'cached' | 'fresh' = 'cached'): SupabaseClient | null {
  requireSupabaseInProduction();
  if (!hasSupabase()) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global:
      mode === 'fresh'
        ? { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: 'no-store' }) }
        : {}
  });
}
