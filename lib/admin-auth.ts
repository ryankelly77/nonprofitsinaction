import 'server-only';
import { redirect } from 'next/navigation';
import { serviceClient } from './supabase/service.ts';
import { sessionClient } from './supabase/session.ts';

export interface CurrentAdmin {
  email: string;
  name: string | null;
  super_admin: boolean;
}

/*
 * Who may use /admin: someone signed in through Supabase Auth (a code emailed
 * to them) whose address is in the admins table. Both, every time. A valid
 * session for an address that has been removed from admins gets nothing, so
 * removing somebody takes effect on their next page load rather than whenever
 * their session happens to expire.
 */
export async function currentAdmin(): Promise<CurrentAdmin | null> {
  // `next dev` only: sign in as LOCAL_ADMIN_EMAIL without a code, for working
  // on the admin against a local database with no auth server.
  // NODE_ENV is "production" in every build, preview deployments included.
  const local = process.env.NODE_ENV === 'development' ? process.env.LOCAL_ADMIN_EMAIL?.toLowerCase() : undefined;
  if (local) {
    const { data } = await serviceClient().from('admins').select('email, name, super_admin').eq('email', local).maybeSingle();
    // A local database with no admins row still signs in, and as a super
    // admin, or the page for adding the first one could never be opened.
    return data ?? { email: local, name: 'Local admin', super_admin: true };
  }
  const auth = await sessionClient();
  const { data } = await auth.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: row } = await serviceClient().from('admins').select('email, name, super_admin').eq('email', email).maybeSingle();
  return row ?? null;
}

export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login/');
  return admin;
}

/*
 * The admin list is the one page an ordinary admin cannot open. Sending them
 * to the queue rather than the sign-in page says the session is fine and this
 * is simply not theirs, which is the truthful answer.
 */
export async function requireSuperAdmin(): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (!admin.super_admin) redirect('/admin/');
  return admin;
}

/** Noted on each sign-in, so the list can show who never used their invitation. */
export async function markSeen(email: string): Promise<void> {
  await serviceClient().from('admins').update({ last_seen_at: new Date().toISOString() }).eq('email', email);
}
