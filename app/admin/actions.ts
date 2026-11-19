'use server';

import { redirect } from 'next/navigation';
import { markSeen, requireAdmin, requireSuperAdmin } from '@/lib/admin-auth';
import { CODE_LENGTH, looksLikeEmail, refuseInvite, refuseRemove, refuseSetSuper, sayRefusal, tidyEmail, type AdminRow } from '@/lib/admins';
import { tidyColor } from '@/lib/colors';
import { keepApart } from '@/lib/duplicates';
import { sendEmail } from '@/lib/email';
import { applyEventEdit } from '@/lib/edit';
import { SITE_URL } from '@/lib/env';
import { freeSlug, logChange } from '@/lib/listing';
import { approveEvent, mergeOrganization, mergeVenue, rejectEvent, setEventStatus } from '@/lib/moderation';
import { suggestAddresses, type AddressSuggestion } from '@/lib/places';
import { refreshPublicPages } from '@/lib/revalidate';
import type { Errors } from '@/lib/submission';
import type { NameKind } from '@/lib/types';
import { slugify } from '@/lib/slug';
import { serviceClient } from '@/lib/supabase/service';
import { sessionClient } from '@/lib/supabase/session';

/* Every admin action checks the admin first, itself. */

/*
 * Signing in. A code is emailed and typed back here, rather than a link that
 * has to be opened in the same browser it was asked for in: the people
 * reviewing listings read mail on a phone and work on a laptop, and a link
 * sends them to the wrong one of the two.
 *
 * Whether the address is on the admin list is never said out loud, in either
 * step, so this page cannot be used to find out who runs the calendar.
 */
export interface SignInState {
  /** Set once a code has been sent, which is what puts the form on step two. */
  email?: string;
  message: string;
}

const CODE_SENT = `If that address is on the admin list, a ${CODE_LENGTH} digit code is on its way. It expires in an hour.`;

export async function requestAdminCode(_prev: SignInState | null, form: FormData): Promise<SignInState> {
  const email = tidyEmail(form.get('email'));
  if (!looksLikeEmail(email)) return { message: 'Enter your email address.' };
  const { data } = await serviceClient().from('admins').select('email').eq('email', email).maybeSingle();
  // Step two is offered either way. A stranger gets a box that will never
  // accept anything, which tells them nothing.
  if (data) {
    const auth = await sessionClient();
    // No emailRedirectTo: that is what makes Supabase send the code rather
    // than a link. The callback route still works for any link already sent.
    const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) console.error('[admin] sign-in code failed:', error.message);
  }
  return { email, message: CODE_SENT };
}

export async function verifyAdminCode(_prev: SignInState | null, form: FormData): Promise<SignInState> {
  const email = tidyEmail(form.get('email'));
  const token = String(form.get('code') ?? '').replace(/\D/g, '');
  if (!email) return { message: 'Start again with your email address.' };
  if (token.length < CODE_LENGTH) return { email, message: `Enter the ${CODE_LENGTH} digit code from the email.` };

  const { data: row } = await serviceClient().from('admins').select('email').eq('email', email).maybeSingle();
  const auth = await sessionClient();
  const { error } = await auth.auth.verifyOtp({ email, token, type: 'email' });
  /*
   * A correct code for an address that is not an admin must not leave a
   * session behind: currentAdmin() would refuse it, but signing out keeps the
   * two from ever disagreeing.
   */
  if (!error && !row) {
    await auth.auth.signOut();
    return { email, message: 'That code did not work. Ask for a new one.' };
  }
  if (error) return { email, message: 'That code did not work. Ask for a new one.' };
  await markSeen(email);
  redirect('/admin/');
}

export async function resendAdminCode(prev: SignInState | null, form: FormData): Promise<SignInState> {
  return requestAdminCode(prev, form);
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
      website: String(form.get('website') ?? '').trim() || null,
      verified: form.get('verified') === 'on'
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

/*
 * One pair of lookalikes, settled in one go.
 *
 * The three answers used to be three buttons side by side, which read as a
 * row of equal choices when only one of them is ever right. They are one
 * question now, asked once, with the answer chosen and then applied.
 */
export async function resolveDuplicateAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const kind = String(form.get('kind')) as NameKind;
  const a = String(form.get('a') ?? '');
  const b = String(form.get('b') ?? '');
  const answer = String(form.get('answer') ?? '');
  if (!a || !b || !answer) return;

  if (answer === 'apart') {
    await keepApart(serviceClient(), kind, a, b, admin.email);
    return;
  }
  // "keep-a" means a is the one that survives, so b is folded into it.
  const [from, into] = answer === 'keep-a' ? [b, a] : answer === 'keep-b' ? [a, b] : [null, null];
  if (!from || !into) return;
  if (kind === 'venue') await mergeVenue(from, into, admin.email);
  else await mergeOrganization(from, into, admin.email);
}

/*
 * What an admin can do to one venue or organization, as a single choice
 * rather than a button for each. Merging is the one that needs somewhere to
 * merge into, which is why the form carries a target as well as an answer.
 */
export async function applyRecordAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const kind = String(form.get('kind')) as NameKind;
  const id = String(form.get('id') ?? '');
  const answer = String(form.get('answer') ?? '');
  const into = String(form.get('into') ?? '');
  if (!id || !answer) return;
  const table = kind === 'venue' ? 'venues' : 'organizations';
  const db = serviceClient();

  if (answer === 'verify' || answer === 'unverify') {
    await db.from(table).update({ verified: answer === 'verify' }).eq('id', id);
    refreshPublicPages();
    return;
  }
  if (answer === 'trust' || answer === 'untrust') {
    await db.from('organizations').update({ auto_approve: answer === 'trust' }).eq('id', id);
    return;
  }
  if (answer === 'retire') return retireRecord(form);
  if (answer === 'restore') return restoreRecord(form);
  if (answer === 'merge' && into) {
    if (kind === 'venue') await mergeVenue(id, into, admin.email);
    else await mergeOrganization(id, into, admin.email);
  }
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

/*
 * Approving a batch. Anything with an unanswered question about a new venue
 * or organization is left behind rather than forced through, because that
 * question is the whole reason the review step exists; the count comes back
 * in the address so she is told what stayed.
 */
export async function approveSelected(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const ids = form.getAll('id').map(String).filter(Boolean);
  const back = String(form.get('back') || '/admin/');
  let approved = 0;
  let held = 0;
  for (const id of ids) {
    try {
      await approveEvent(id, admin.email);
      approved++;
    } catch {
      held++;
    }
  }
  const sep = back.includes('?') ? '&' : '?';
  redirect(`${back}${sep}approved=${approved}${held ? `&held=${held}` : ''}`);
}

/* Publish this organization's listings as they arrive, or stop doing that. */
export async function setAutoApprove(form: FormData): Promise<void> {
  await requireAdmin();
  const db = serviceClient();
  await db
    .from('organizations')
    .update({ auto_approve: form.get('auto') === 'on' })
    .eq('id', String(form.get('id')));
}

/*
 * Retire a venue or organization: out of every picker and list, but still
 * attached to the events that name it, so no event loses its venue and no
 * address a visitor saved stops working. Something nothing points at is
 * deleted outright, since there is nothing to keep working.
 */
export async function retireRecord(form: FormData): Promise<void> {
  await requireAdmin();
  const kind = String(form.get('kind')) as NameKind;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const db = serviceClient();
  const table = kind === 'venue' ? 'venues' : 'organizations';
  const column = kind === 'venue' ? 'venue_id' : 'organization_id';
  const count = async (t: string, c: string) => ((await db.from(t).select('id', { count: 'exact', head: true }).eq(c, id)).count ?? 0);

  /*
   * Everything that points at this, not just events: a submission names the
   * organization it came from, and a duplicate that was merged in still
   * points at what it was merged into. Deleting with either of those around
   * fails on the foreign key, and it would take a submitter's edit link with
   * it. Anything pointed at is retired; only something nothing refers to is
   * actually removed.
   */
  const referring = [await count('events', column), await count(table, 'merged_into'), kind === 'organization' ? await count('submissions', 'organization_id') : 0];

  if (referring.every((n) => n === 0)) await db.from(table).delete().eq('id', id);
  else await db.from(table).update({ retired: true }).eq('id', id);
  refreshPublicPages();
}

export async function restoreRecord(form: FormData): Promise<void> {
  await requireAdmin();
  const kind = String(form.get('kind')) as NameKind;
  const db = serviceClient();
  await db
    .from(kind === 'venue' ? 'venues' : 'organizations')
    .update({ retired: false })
    .eq('id', String(form.get('id')));
  refreshPublicPages();
}

/* Adding a venue or an organization by hand, already checked by definition. */
export async function addRecord(form: FormData): Promise<void> {
  await requireAdmin();
  const kind = String(form.get('kind')) as NameKind;
  const name = String(form.get('name') ?? '').trim();
  if (name.length < 2) return;
  const db = serviceClient();
  const table = kind === 'venue' ? 'venues' : 'organizations';
  const slug = await freeSlug(db, table, name);
  const extra =
    kind === 'venue'
      ? { address_line1: String(form.get('address') ?? '').trim() || null, city: String(form.get('city') ?? '').trim() || 'San Antonio', state: 'TX' }
      : { cause_slug: String(form.get('cause') ?? '') || null };
  await db.from(table).insert({ name, slug, verified: true, ...extra });
  refreshPublicPages();
}

/* ---- the lookup lists ---------------------------------------------------- */

/*
 * Event types and causes are retired rather than deleted once anything is
 * filed under them, for the same reason: an event keeps its type and an
 * organization keeps its cause, they simply stop being offered on the form.
 */
export async function saveEventType(form: FormData): Promise<void> {
  await requireAdmin();
  const db = serviceClient();
  const slug = String(form.get('slug') ?? '').trim();
  const label = String(form.get('label') ?? '').trim();
  const plural = String(form.get('plural') ?? '').trim() || label;
  const sort = Number(form.get('sort')) || 0;
  const active = form.get('active') === 'on';
  // Anything not on the approved list becomes the default here, rather than
  // reaching the check constraint and failing with a database error.
  const color = tidyColor(form.get('color'));
  if (!label) return;
  if (slug) await db.from('event_types').update({ label, plural, sort, active, color }).eq('slug', slug);
  else await db.from('event_types').insert({ slug: slugify(label), label, plural, sort, active: true, color });
  refreshPublicPages();
}

export async function saveCause(form: FormData): Promise<void> {
  await requireAdmin();
  const db = serviceClient();
  const slug = String(form.get('slug') ?? '').trim();
  const label = String(form.get('label') ?? '').trim();
  const sort = Number(form.get('sort')) || 0;
  const active = form.get('active') === 'on';
  if (!label) return;
  if (slug) await db.from('causes').update({ label, sort, active }).eq('slug', slug);
  else await db.from('causes').insert({ slug: slugify(label), label, sort, active: true });
  refreshPublicPages();
}

/* ---- her wording for turning a listing down ------------------------------ */

export async function saveRejectionReason(form: FormData): Promise<void> {
  await requireAdmin();
  const db = serviceClient();
  const id = String(form.get('id') ?? '');
  const label = String(form.get('label') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();
  const sort = Number(form.get('sort')) || 0;
  const active = form.get('active') === 'on';
  if (!label || !body) return;
  if (id) await db.from('rejection_reasons').update({ label, body, sort, active }).eq('id', id);
  else await db.from('rejection_reasons').insert({ label, body, sort });
}

export async function deleteRejectionReason(form: FormData): Promise<void> {
  await requireAdmin();
  // Nothing points at these, so there is nothing to keep working.
  await serviceClient().from('rejection_reasons').delete().eq('id', String(form.get('id')));
}

/*
 * A place that has no street address and never will: the Historic Pearl,
 * Hemisfair, Downtown. Settling the question is its own answer, because the
 * other two available were inventing a door or retiring a venue that events
 * are really held at.
 */
export async function acceptNoStreetAddress(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  if (!id) return;
  await serviceClient().from('venues').update({ no_street_address: true, verified: true }).eq('id', id);
  refreshPublicPages();
}

/*
 * Where Google thinks a venue is. Suggestions only: nothing is written until
 * an admin picks one and saves, because an address is a fact about the world
 * and a guessed one sends people to the wrong building.
 */
export async function suggestVenueAddress(name: string): Promise<AddressSuggestion[]> {
  await requireAdmin();
  return suggestAddresses(name);
}

/* ---- who reviews listings ------------------------------------------------ */

/*
 * Adding and removing admins. Every one of these re-reads the whole list and
 * asks lib/admins.ts, rather than trusting what the page was showing: the
 * page may have been open since before somebody else changed the same thing.
 */
async function adminRows(): Promise<AdminRow[]> {
  const { data } = await serviceClient().from('admins').select('email, super_admin');
  return (data ?? []) as AdminRow[];
}

export async function inviteAdmin(_prev: { message: string } | null, form: FormData): Promise<{ message: string }> {
  const me = await requireSuperAdmin();
  const email = tidyEmail(form.get('email'));
  const name = String(form.get('name') ?? '').trim() || null;
  if (!looksLikeEmail(email)) return { message: 'Enter the email address to invite.' };

  const why = refuseInvite(await adminRows(), me.email, email);
  if (why) return { message: sayRefusal(why) };

  const { error } = await serviceClient()
    .from('admins')
    .insert({ email, name, notify: form.get('notify') === 'on', super_admin: false, invited_by: me.email });
  if (error) return { message: `Not added: ${error.message}` };

  await sendEmail({
    to: email,
    subject: 'You can now review listings on the Nonprofits in Action calendar',
    text: [
      name ? `Hi ${name},` : 'Hello,',
      '',
      `${me.name ?? me.email} has added you to the admin for the Nonprofits in Action calendar, San Antonio's shared calendar of nonprofit events.`,
      '',
      'To sign in:',
      `${SITE_URL}/admin/login/`,
      '',
      `Enter this email address and we will send you a ${CODE_LENGTH} digit code. There is no password, and you will get a new code each time you sign in.`,
      '',
      'Nonprofits in Action',
      'San Antonio Community Calendar'
    ].join('\n'),
    replyTo: me.email
  });
  return { message: `Invited ${email}. The sign-in instructions are on their way.` };
}

export async function removeAdmin(form: FormData): Promise<void> {
  const me = await requireSuperAdmin();
  const email = tidyEmail(form.get('email'));
  if (refuseRemove(await adminRows(), me.email, email)) return;
  await serviceClient().from('admins').delete().eq('email', email);
}

export async function setAdminSuper(form: FormData): Promise<void> {
  const me = await requireSuperAdmin();
  const email = tidyEmail(form.get('email'));
  const next = form.get('super') === 'on';
  if (refuseSetSuper(await adminRows(), me.email, email, next)) return;
  await serviceClient().from('admins').update({ super_admin: next }).eq('email', email);
}

export async function setAdminNotify(form: FormData): Promise<void> {
  await requireSuperAdmin();
  await serviceClient()
    .from('admins')
    .update({ notify: form.get('notify') === 'on' })
    .eq('email', tidyEmail(form.get('email')));
}
