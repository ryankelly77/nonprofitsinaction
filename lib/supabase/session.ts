import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/*
 * The signed-in admin's Supabase Auth session, read from cookies. Used only to
 * learn WHO is signed in (lib/admin-auth.ts). Admin reads and writes then go
 * through the service role after that check.
 */
export async function sessionClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a server component, where cookies are read-only. The
          // proxy refreshes the session on the next request instead.
        }
      }
    },
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: 'no-store' }) }
  });
}
