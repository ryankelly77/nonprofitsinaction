'use server';

import { headers } from 'next/headers';
import { sendEmail } from '@/lib/email';
import { SITE_URL } from '@/lib/env';
import { findOrCreateOrganization, freeSlug, logChange, resolveVenue } from '@/lib/listing';
import { notifyAdmins } from '@/lib/notify';
import { parseSubmission, type Errors } from '@/lib/submission';
import { serviceClient } from '@/lib/supabase/service';
import { localParts, longDate, timeRange, todayLocal, dayRange } from '@/lib/time';
import { newManageToken } from '@/lib/tokens';
import { verifyTurnstile } from '@/lib/turnstile';

export type SubmitResult = { ok: true; count: number; email: string } | { ok: false; errors: Errors; message: string };

/*
 * A listing from the public form. In order: check everything, store it as
 * pending, then tell the submitter and the admins. Nothing is public until an
 * admin approves it.
 */
export async function submitListing(raw: unknown): Promise<SubmitResult> {
  const db = serviceClient();
  const [types, causes] = await Promise.all([
    db.from('event_types').select('slug').eq('active', true),
    db.from('causes').select('slug')
  ]);
  const parsed = parseSubmission(raw, {
    today: todayLocal(),
    typeSlugs: new Set((types.data ?? []).map((t: { slug: string }) => t.slug)),
    causeSlugs: new Set((causes.data ?? []).map((c: { slug: string }) => c.slug))
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors, message: 'A few details need another look. They are marked below.' };
  const { organization, submitter, events } = parsed.value;

  // A bot is told it succeeded and nothing is stored.
  if (parsed.bot) return { ok: true, count: events.length, email: submitter.email };

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (!(await verifyTurnstile(parsed.value.turnstileToken, ip))) {
    return { ok: false, errors: {}, message: 'We could not confirm the form was sent by a person. Please try again.' };
  }

  // Undone if anything below fails, so a retry does not leave half a listing behind.
  const createdEvents: string[] = [];
  let submissionId: string | null = null;
  try {
    const org = await findOrCreateOrganization(db, organization);
    const organizationId = org.id;
    const { token, hash } = newManageToken();
    const sub = await db
      .from('submissions')
      .insert({ submitter_name: submitter.name, submitter_email: submitter.email, organization_id: organizationId, manage_token_hash: hash, source: 'web' })
      .select('id')
      .single();
    if (sub.error) throw new Error(sub.error.message);
    submissionId = sub.data.id;

    const reserved = new Set<string>();
    const lines: string[] = [];
    const adminLines: string[] = [];
    for (const e of events) {
      const venue = await resolveVenue(db, e.venue);
      let slug = await freeSlug(db, 'events', e.title, reserved);
      reserved.add(slug);
      const row = {
        title: e.title,
        description: e.description,
        organization_id: organizationId,
        venue_id: venue.id,
        event_type_slug: e.event_type_slug,
        format: e.format,
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        all_day: e.all_day,
        online_url: e.online_url,
        ticket_url: e.ticket_url,
        image_path: e.image_path,
        moderation: 'pending',
        submission_id: sub.data.id,
        review_flags: [...(venue.isNew ? ['venue-new'] : []), ...(org.isNew ? ['organization-new'] : [])]
      };
      // Two listings with the same name at the same moment can both pick the
      // same free address; the loser takes the next one.
      let ins = await db.from('events').insert({ ...row, slug }).select('id').single();
      for (let attempt = 0; ins.error?.code === '23505' && attempt < 3; attempt++) {
        reserved.add(slug);
        slug = await freeSlug(db, 'events', e.title, reserved);
        ins = await db.from('events').insert({ ...row, slug }).select('id').single();
      }
      if (ins.error) throw new Error(ins.error.message);
      createdEvents.push(ins.data.id);
      await logChange(db, ins.data.id, 'submitter', 'created');

      const when = `${longDate(e.starts_at)}, ${timeRange(e.starts_at, e.ends_at, e.all_day)}`;
      lines.push(`- ${e.title}, ${when}`);

      // What else is already on that night, for the reviewer.
      const day = dayRange(localParts(e.starts_at).date);
      const { data: same } = await db
        .from('events')
        .select('title, organization:organizations(name)')
        .eq('moderation', 'approved')
        .lt('starts_at', day.end.toISOString())
        .gt('ends_at', day.start.toISOString());
      const clash = (same ?? []).map((s: { title: string; organization: { name: string } | { name: string }[] | null }) => {
        const o = Array.isArray(s.organization) ? s.organization[0] : s.organization;
        return `${s.title}${o ? ` (${o.name})` : ''}`;
      });
      adminLines.push(`- ${e.title}, ${when}${venue.isNew ? ' [new venue]' : ''}${clash.length ? `\n  Same day: ${clash.join('; ')}` : ''}`);
    }

    const n = events.length;
    await sendEmail({
      to: submitter.email,
      subject: n === 1 ? `We received your event: ${events[0].title}` : `We received your ${n} events`,
      text: [
        `Hi ${submitter.name},`,
        '',
        `Thanks for listing with Nonprofits in Action. We received:`,
        '',
        ...lines,
        '',
        'We review every listing before it goes on the calendar, and we will email you when it is live.',
        '',
        'To change or cancel your listing at any time, use your private link:',
        `${SITE_URL}/manage/${token}/`,
        '',
        'Keep this email. Anyone with the link can edit the listing, so please do not forward it.',
        '',
        'Nonprofits in Action',
        'San Antonio Community Calendar'
      ].join('\n')
    });
    await notifyAdmins(
      `New listing to review: ${organization.name} (${n} event${n > 1 ? 's' : ''})`,
      [`From ${submitter.name} <${submitter.email}>`, '', ...adminLines, '', `Review: ${SITE_URL}/admin/`].join('\n')
    );

    return { ok: true, count: n, email: submitter.email };
  } catch (err) {
    console.error('[submit] failed:', err);
    if (createdEvents.length) await db.from('events').delete().in('id', createdEvents);
    if (submissionId) await db.from('submissions').delete().eq('id', submissionId);
    return {
      ok: false,
      errors: {},
      message: 'Something went wrong on our side and your listing was not saved. Please try again in a few minutes.'
    };
  }
}
