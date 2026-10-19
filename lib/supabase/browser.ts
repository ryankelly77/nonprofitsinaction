'use client';

import { createBrowserClient } from '@supabase/ssr';

/*
 * In the browser the anon key is used for two things only: sending the admin
 * sign-in link, and uploading an image to a signed upload URL the server
 * issued. Reading events in the browser goes through this site's own API.
 */
export function browserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
