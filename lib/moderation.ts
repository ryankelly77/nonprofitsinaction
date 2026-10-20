import 'server-only';
import { hasOpenQuestions, nameQuestions } from './duplicates.ts';
import { sendEmail } from './email.ts';
import { SITE_URL } from './env.ts';
import { logChange } from './listing.ts';
import { notifyAdmins } from './notify.ts';
import { refreshPublicPages } from './revalidate.ts';
import { serviceClient } from './supabase/service.ts';
import { longDate, timeRange } from './time.ts';

/*
 * Everything that changes what the public sees, in one place: approving,
 * rejecting, cancelling, merging duplicates. Each writes the event's history
 * and refreshes the public pages. Callers have already checked who is acting.
 */

interface EventWithSubmitter {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  venue_id: string | null;
  published_at: string | null;
  review_flags: string[];
  organization: { id: string; name: string };
  venue: { id: string; name: string; verified: boolean } | null;
  submission: { submitter_name: string; submitter_email: string } | null;
}

async function loadEvent(id: string): Promise<EventWithSubmitter> {
  const { data, error } = await serviceClient()
    .from('events')
    .select(
      'id, slug, title, starts_at, ends_at, all_day, venue_id, published_at, review_flags, organization:organizations(id, name), venue:venues(id, name, verified), submission:submissions(submitter_name, submitter_email)'
    )
    .eq('id', id)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Event not found');
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const sub = one(data.submission);
  return {
    ...(data as unknown as EventWithSubmitter),
    organization: one(data.organization) as EventWithSubmitter['organization'],
    venue: one(data.venue) as EventWithSubmitter['venue'],
    submission: sub ?? null
  };
}

export async function approveEvent(id: string, admin: string): Promise<void> {
  const db = serviceClient();
  const e = await loadEvent(id);

  /*
   * A new venue or a new organization that looks like one already listed is
   * a question for an admin, not something publishing should decide. The
   * review page asks it and disables Approve until it is answered; this is
   * the same rule on the server, for any other way in.
   */
  const questions = await nameQuestions(db, e);
  if (hasOpenQuestions(questions)) {
    throw new Error('Say whether the venue or organization is one already listed before approving this.');
  }

  const { error } = await db
    .from('events')
    .update({
      moderation: 'approved',
      rejection_reason: null,
      published_at: e.published_at ?? new Date().toISOString(),
      review_flags: e.review_flags.filter((f) => f !== 'venue-new' && f !== 'organization-new')
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  // Approving an event with a venue typed in by hand vouches for the venue
  // too, so it is offered to the next person who types its name. Only once
  // nothing is outstanding about the name: a misspelling that is really an
  // existing venue must never become a suggestion.
  if (e.venue_id && questions.venue.length === 0) {
    await db.from('venues').update({ verified: true }).eq('id', e.venue_id).eq('verified', false);
  }
  // And for the organization, on the same terms.
  if (questions.organization.length === 0) {
    await db.from('organizations').update({ verified: true }).eq('id', e.organization.id).eq('verified', false);
  }
  await logChange(db, id, `admin:${admin}`, 'approved');
  refreshPublicPages();

  if (e.submission?.submitter_email && !e.published_at) {
    await sendEmail({
      to: e.submission.submitter_email,
      subject: `Your event is live: ${e.title}`,
      text: [
        `Hi ${e.submission.submitter_name},`,
        '',
        `${e.title} is now on the Nonprofits in Action calendar:`,
        `${SITE_URL}/events/${e.slug}/`,
        '',
        `${longDate(e.starts_at)}, ${timeRange(e.starts_at, e.ends_at, e.all_day)}`,
        '',
        'Share the link with your supporters. To change or cancel the listing, use the private link in your confirmation email.',
        `If you cannot find it, get a new one at ${SITE_URL}/manage/`,
        '',
        'Nonprofits in Action',
        'San Antonio Community Calendar'
      ].join('\n')
    });
  }
}

export async function rejectEvent(id: string, reason: string, admin: string, tellSubmitter: boolean): Promise<void> {
  const db = serviceClient();
  const e = await loadEvent(id);
  const { error } = await db.from('events').update({ moderation: 'rejected', rejection_reason: reason || null }).eq('id', id);
  if (error) throw new Error(error.message);
  await logChange(db, id, `admin:${admin}`, 'rejected', reason ? { reason } : undefined);
  refreshPublicPages();
  if (tellSubmitter && e.submission?.submitter_email) {
    await sendEmail({
      to: e.submission.submitter_email,
      subject: `About your listing: ${e.title}`,
      text: [
        `Hi ${e.submission.submitter_name},`,
        '',
        `Thanks for submitting ${e.title}. We were not able to add it to the calendar.`,
        ...(reason ? ['', reason] : []),
        '',
        'If you have questions, reply to this email.',
        '',
        'Nonprofits in Action'
      ].join('\n')
    });
  }
}

export async function setEventStatus(id: string, status: 'scheduled' | 'cancelled' | 'postponed', actor: string): Promise<void> {
  const db = serviceClient();
  const e = await loadEvent(id);
  const { error } = await db.from('events').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  const action = status === 'scheduled' ? 'restored' : status;
  await logChange(db, id, actor, action);
  refreshPublicPages();
  if (actor === 'submitter') {
    const word = action === 'cancelled' ? 'canceled' : action;
    await notifyAdmins(`Listing ${word} by its organizer: ${e.title}`, `${SITE_URL}/admin/events/${id}/`);
  }
}

/** Fold a duplicate venue into the one it duplicates. One transaction, in the database (merge_venues). */
export async function mergeVenue(fromId: string, intoId: string, admin: string): Promise<number> {
  const { data, error } = await serviceClient().rpc('merge_venues', { from_id: fromId, into_id: intoId, actor: `admin:${admin}` });
  if (error) throw new Error(error.message);
  refreshPublicPages();
  return data as number;
}

/** Fold a duplicate organization into the one it duplicates (merge_organizations). */
export async function mergeOrganization(fromId: string, intoId: string, admin: string): Promise<number> {
  const { data, error } = await serviceClient().rpc('merge_organizations', { from_id: fromId, into_id: intoId, actor: `admin:${admin}` });
  if (error) throw new Error(error.message);
  refreshPublicPages();
  return data as number;
}
