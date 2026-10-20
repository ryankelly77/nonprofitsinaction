'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { keepApart } from '@/lib/duplicates';
import { applyEventEdit } from '@/lib/edit';
import { SITE_URL } from '@/lib/env';
import { logChange } from '@/lib/listing';
import { approveEvent, mergeOrganization, mergeVenue, rejectEvent, setEventStatus } from '@/lib/moderation';
import { refreshPublicPages } from '@/lib/revalidate';
import type { Errors } from '@/lib/submission';
import type { NameKind } from '@/lib/types';
import { serviceClient } from '@/lib/supabase/service';
import { sessionClient } from '@/lib/supabase/session';

/* Every admin action checks the admin first, itself. */

export async function requestAdminLink(_prev: { message: string } | null, form: FormData): Promise<{ message: string }> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const message = 'If that address is on the admin list, a sign-in link is on its way. It works once, in this browser.';
  if (!email) return { message: 'Enter your email address.' };
  const { data } = await serviceClient().from('admins').select('email').eq('email', email).maybeSingle();
  if (!data) return { message };
  const auth = await sessionClient();
  const { error } = await auth.auth.signInWithOtp({ email, options: { emailRedirectTo: `${SITE_URL}/admin/auth/callback/`, shouldCreateUser: true } });
  if (error) console.error('[admin] sign-in link failed:', error.message);
  return { message };
}

export async function signOut(): Promise<void> {
  const auth = await sessionClient();
  await auth.auth.signOut();
  redirect('/admin/login/');
}

export async function approve(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  await approveEvent(String(form.get('id')), admin.email);
  const back = String(form.get('back') ?? '');
  if (back) redirect(back);
}

export async function reject(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  await rejectEvent(String(form.get('id')), String(form.get('reason') ?? '').trim(), admin.email, form.get('tell') === 'on');
  const back = String(form.get('back') ?? '');
  if (back) redirect(back);
}

export async function setStatus(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const status = String(form.get('status')) as 'scheduled' | 'cancelled' | 'postponed';
  await setEventStatus(String(form.get('id')), status, `admin:${admin.email}`);
}

export async function clearFlags(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(form.get('id'));
  const db = serviceClient();
  await db.from('events').update({ review_flags: [] }).eq('id', id);
  await logChange(db, id, `admin:${admin.email}`, 'edited', { review_flags: 'cleared' });
}

export async function saveEventAsAdmin(
  id: string,
  input: unknown,
  extra: { organizationId: string; featured: boolean }
): Promise<{ ok: true; message: string } | { ok: false; errors: Errors; message: string }> {
  const admin = await requireAdmin();
  const r = await applyEventEdit(id, input, `admin:${admin.email}`);
  if (!r.ok) return { ok: false, errors: r.errors, message: r.errors.form ?? 'A few details need another look.' };
  const db = serviceClient();
  const { data: before } = await db.from('events').select('organization_id, featured').eq('id', id).single();
  if (before && (before.organization_id !== extra.organizationId || before.featured !== extra.featured)) {
    const { error } = await db.from('events').update({ organization_id: extra.organizationId, featured: extra.featured }).eq('id', id);
    if (error) return { ok: false, errors: {}, message: `Not saved: ${error.message}` };
    await logChange(db, id, `admin:${admin.email}`, 'edited', {
      ...(before.organization_id !== extra.organizationId ? { organization_id: { from: before.organization_id, to: extra.organizationId } } : {}),
      ...(before.featured !== extra.featured ? { featured: { from: before.featured, to: extra.featured } } : {})
    });
    refreshPublicPages();
  }
  return { ok: true, message: r.changed.length || before?.organization_id !== extra.organizationId ? 'Saved.' : 'Nothing changed.' };
}

export async function verifyVenue(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get('id'));
  const db = serviceClient();
  await db
    .from('venues')
    .update({
      name: String(form.get('name') ?? '').trim() || undefined,
      address_line1: String(form.get('address') ?? '').trim() || null,
      city: String(form.get('city') ?? '').trim() || null,
      postal_code: String(form.get('postal') ?? '').trim() || null,
      verified: form.get('verified') === 'on'
    })
    .eq('id', id);
  refreshPublicPages();
}

export async function mergeVenueAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const into = String(form.get('into') ?? '');
  if (into) await mergeVenue(String(form.get('id')), into, admin.email);
}

export async function saveOrganization(form: FormData): Promise<void> {
  await requireAdmin();
  const db = serviceClient();
  await db
    .from('organizations')
    .update({
      name: String(form.get('name') ?? '').trim() || undefined,
      cause_slug: String(form.get('cause') ?? '') || null,
      website: String(form.get('website') ?? '').trim() || null
    })
    .eq('id', String(form.get('id')));
  refreshPublicPages();
}

export async function mergeOrganizationAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const into = String(form.get('into') ?? '');
  if (into) await mergeOrganization(String(form.get('id')), into, admin.email);
}

/*
 * The duplicate lists and the review page both offer the same two answers
 * about a pair of records: fold one into the other, or say they are two
 * different places and stop being asked.
 */

export async function mergePairAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const kind = String(form.get('kind')) as NameKind;
  const from = String(form.get('from') ?? '');
  const into = String(form.get('into') ?? '');
  if (!from || !into) return;
  if (kind === 'venue') await mergeVenue(from, into, admin.email);
  else await mergeOrganization(from, into, admin.email);
}

export async function keepApartAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const kind = String(form.get('kind')) as NameKind;
  const a = String(form.get('a') ?? '');
  const b = String(form.get('b') ?? '');
  if (!a || !b) return;
  await keepApart(serviceClient(), kind, a, b, admin.email);
}

/*
 * "Keep as new" on the review page: the record stays its own, and every pair
 * it was asked about is remembered so the question does not come back.
 */
export async function keepAsNewAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const kind = String(form.get('kind')) as NameKind;
  const id = String(form.get('id') ?? '');
  const others = form.getAll('other').map(String).filter(Boolean);
  if (!id || others.length === 0) return;
  const db = serviceClient();
  for (const other of others) await keepApart(db, kind, id, other, admin.email);
}
