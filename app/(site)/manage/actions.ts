'use server';

import { headers } from 'next/headers';
import { applyEventEdit } from '@/lib/edit';
import { sendEmail } from '@/lib/email';
import { SITE_URL } from '@/lib/env';
import { setEventStatus } from '@/lib/moderation';
import { notifyAdmins } from '@/lib/notify';
import type { Errors } from '@/lib/submission';
import { serviceClient } from '@/lib/supabase/service';
import { hashToken, newManageToken } from '@/lib/tokens';
import { verifyTurnstile } from '@/lib/turnstile';

/*
 * The private edit link's actions. The token comes with every call and is
 * checked every time; there is no session to steal.
 */

async function eventForToken(token: string, eventId: string): Promise<{ submissionId: string; title: string } | null> {
  const db = serviceClient();
  const { data: sub } = await db.from('submissions').select('id').eq('manage_token_hash', hashToken(token)).maybeSingle();
  if (!sub) return null;
  const { data: ev } = await db.from('events').select('id, title, submission_id').eq('id', eventId).maybeSingle();
  if (!ev || ev.submission_id !== sub.id) return null;
  return { submissionId: sub.id, title: ev.title };
}

export async function saveManagedEvent(token: string, eventId: string, input: unknown): Promise<{ ok: true; message: string } | { ok: false; errors: Errors; message: string }> {
  const owned = await eventForToken(token, eventId);
  if (!owned) return { ok: false, errors: {}, message: 'This link no longer works. Get a new one from the manage page.' };
  const r = await applyEventEdit(eventId, input, 'submitter');
  if (!r.ok) return { ok: false, errors: r.errors, message: r.errors.form ?? 'A few details need another look.' };
  if (r.changed.length === 0) return { ok: true, message: 'Nothing changed.' };
  if (r.wasLive) {
    await notifyAdmins(`Live listing edited by its organizer: ${owned.title}`, `Changed: ${r.changed.join(', ')}\n${SITE_URL}/admin/events/${eventId}/`);
  }
  return { ok: true, message: r.wasLive ? 'Saved. The calendar shows your changes now.' : 'Saved. Your changes will be in the listing when it is approved.' };
}

export async function setManagedStatus(token: string, eventId: string, status: 'scheduled' | 'cancelled' | 'postponed'): Promise<{ ok: boolean; message: string }> {
  const owned = await eventForToken(token, eventId);
  if (!owned) return { ok: false, message: 'This link no longer works. Get a new one from the manage page.' };
  await setEventStatus(eventId, status, 'submitter');
  return {
    ok: true,
    message:
      status === 'cancelled'
        ? 'Marked as canceled. It stays on the calendar with a canceled label so planners know the date is free.'
        : status === 'postponed'
          ? 'Marked as postponed. Edit the date when you have a new one, then mark it scheduled again.'
          : 'Marked as scheduled again.'
  };
}

/*
 * Lost the link: send a fresh one to the address the listing was made from.
 * The answer is the same whether or not the address is known, so this form
 * cannot be used to find out who has listed events.
 */
export async function requestManageLinks(email: string, turnstileToken?: string): Promise<{ message: string }> {
  const message = 'If that address has listings with us, we just emailed a new private link for each. Links sent before stop working.';
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { message: 'Enter the email address you used when you listed the event.' };
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (!(await verifyTurnstile(turnstileToken, ip))) return { message: 'We could not confirm the form was sent by a person. Please try again.' };

  const db = serviceClient();
  // Includes listings imported from the old site, matched by their contact address.
  const { data: subs } = await db
    .from('submissions')
    .select('id, manage_link_sent_at, events(title)')
    .eq('submitter_email', clean)
    .order('created_at', { ascending: false })
    .limit(50);
  const links: string[] = [];
  for (const s of subs ?? []) {
    const titles = ((s.events ?? []) as Array<{ title: string }>).map((e) => e.title);
    if (titles.length === 0) continue;
    // Not again within 15 minutes: otherwise anyone who knows the address
    // could keep breaking the owner's link by asking for new ones.
    if (s.manage_link_sent_at && Date.now() - Date.parse(s.manage_link_sent_at) < 15 * 60_000) continue;
    const { token, hash } = newManageToken();
    await db.from('submissions').update({ manage_token_hash: hash, manage_link_sent_at: new Date().toISOString() }).eq('id', s.id);
    links.push(`${titles.join(', ')}\n${SITE_URL}/manage/${token}/`);
  }
  if (links.length) {
    await sendEmail({
      to: clean,
      subject: 'Your private links to manage your listings',
      text: [
        'Here is a new private link for each of your listings on Nonprofits in Action. Links we sent before no longer work.',
        '',
        ...links.flatMap((l) => [l, '']),
        'Anyone with a link can edit that listing, so please do not forward this email.',
        '',
        'Nonprofits in Action'
      ].join('\n')
    });
  }
  return { message };
}
