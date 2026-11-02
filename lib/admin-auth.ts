import 'server-only';
import { redirect } from 'next/navigation';
import { serviceClient } from './supabase/service.ts';
import { sessionClient } from './supabase/session.ts';

/*
 * Who may use /admin: someone signed in through Supabase Auth (a magic link)
 * whose address is in the admins table. Both, every time. A valid session
 * for an address that has been removed from admins gets nothing.
 */
export async function currentAdmin(): Promise<{ email: string; name: string | null } | null> {
  // `next dev` only: sign in as LOCAL_ADMIN_EMAIL without a magic link, for
  // working on the admin against a local database with no auth server.
  // NODE_ENV is "production" in every build, preview deployments included.
  if (process.env.NODE_ENV === 'development' && process.env.LOCAL_ADMIN_EMAIL) {
    return { email: process.env.LOCAL_ADMIN_EMAIL.toLowerCase(), name: 'Local admin' };
  }
  const auth = await sessionClient();
  const { data } = await auth.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: row } = await serviceClient().from('admins').select('email, name').eq('email', email).maybeSingle();
  return row ?? null;
}

export async function requireAdmin(): Promise<{ email: string; name: string | null }> {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login/');
  return admin;
}
