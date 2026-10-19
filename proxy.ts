import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/*
 * Runs only for /admin (see `config`). Keeps the admin's Supabase session
 * fresh: a server component cannot write cookies, so a refreshed token is
 * written here, on the way in. Whether the person is an admin is decided in
 * lib/admin-auth.ts, not here.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      }
    }
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/admin/:path*']
};
