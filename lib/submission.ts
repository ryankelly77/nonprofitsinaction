import { z } from 'zod';
import { addDays, isDateString, isTimeString, zonedToUtc } from './time.ts';

/*
 * What the public listing form may send, and what it turns into.
 *
 * The browser does light checks for convenience; this is the check that
 * counts. It runs on the server for every submission and every edit made
 * through a private link. tests/submission.test.ts covers the rules.
 *
 * Messages are written for the person filling the form in, and each is keyed
 * to the field it is about ("events.0.date") so the form can show it there.
 */

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'Enter a full web address, starting with https://');

const optionalUrl = z.union([z.literal(''), httpUrl]).optional();

const venueInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().max(140).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(10).optional()
});

export const eventInput = z.object({
  title: z.string().trim().min(3, 'Give the event a name.').max(140, 'Keep the name under 140 characters.'),
  type: z.string().min(1, 'Pick the kind of event.'),
  format: z.enum(['in_person', 'virtual', 'hybrid']),
  date: z.string(),
  endDate: z.string().optional(),
  allDay: z.boolean().default(false),
  start: z.string().optional(),
  end: z.string().optional(),
  venue: venueInput.nullable().optional(),
  onlineUrl: optionalUrl,
  ticketUrl: optionalUrl,
  description: z.string().trim().max(2000, 'Keep the description under 2,000 characters.').optional(),
  imagePath: z
    .string()
    .regex(/^submissions\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/)
    .optional()
    .or(z.literal(''))
});

export const submissionInput = z.object({
  organization: z.object({
    name: z.string().trim().min(2, 'Enter your organization’s name.').max(120),
    cause: z.string().min(1, 'Pick the cause that fits best.'),
    sector: z.enum(['nonprofit', 'for_profit', 'public'], { message: 'Choose one.' })
  }),
  submitter: z.object({
    name: z.string().trim().min(2, 'Enter your name.').max(100),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter an email address we can reach you at.'))
  }),
  events: z.array(eventInput).min(1).max(3),
  /** Honeypot: a field people never see. Anything typed here is a bot. */
  website: z.string().optional(),
  /** When the form was opened (ms). A form filled in under 3 seconds is a bot. */
  startedAt: z.number().optional(),
  turnstileToken: z.string().optional()
});

export type SubmissionInput = z.infer<typeof submissionInput>;
export type EventInput = z.infer<typeof eventInput>;

export interface NormalizedEvent {
  title: string;
  event_type_slug: string;
  format: 'in_person' | 'virtual' | 'hybrid';
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  venue: { id: string } | { new: { name: string; address: string | null; city: string | null; postalCode: string | null } } | null;
  online_url: string | null;
  ticket_url: string | null;
  description: string | null;
  image_path: string | null;
}

export type Errors = Record<string, string>;

function zodErrors(error: z.ZodError): Errors {
  const out: Errors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * One event's dates, times, place and links, checked and turned into what
 * the database stores. `prefix` is where its errors go ("events.0").
 */
export function normalizeEvent(
  e: EventInput,
  prefix: string,
  ctx: { today: string; typeSlugs: Set<string>; allowPast?: boolean }
): { value?: NormalizedEvent; errors: Errors } {
  const errors: Errors = {};
  const err = (field: string, message: string) => {
    if (!errors[`${prefix}.${field}`]) errors[`${prefix}.${field}`] = message;
  };

  if (!ctx.typeSlugs.has(e.type)) err('type', 'Pick the kind of event.');

  // Dates
  if (!isDateString(e.date)) err('date', 'Pick the date of the event.');
  else if (!ctx.allowPast && e.date < ctx.today) err('date', 'That date has passed.');
  else if (e.date > addDays(ctx.today, 3 * 366)) err('date', 'We list events up to three years ahead.');
  const endDate = e.endDate && e.endDate !== '' ? e.endDate : e.date;
  if (e.endDate && e.endDate !== '' && !isDateString(e.endDate)) err('endDate', 'Pick the date it ends.');
  else if (isDateString(e.date) && endDate < e.date) err('endDate', 'The end date is before the start date.');
  else if (isDateString(e.date) && endDate > addDays(e.date, 31)) err('endDate', 'Events can run at most a month. List longer programs as separate dates.');

  // Times
  let starts: Date | null = null;
  let ends: Date | null = null;
  if (isDateString(e.date) && isDateString(endDate)) {
    if (e.allDay) {
      starts = zonedToUtc(e.date, '00:00');
      ends = zonedToUtc(addDays(endDate, 1), '00:00');
    } else {
      if (!e.start || !isTimeString(e.start)) err('start', 'Enter a start time.');
      if (!e.end || !isTimeString(e.end)) err('end', 'Enter an end time.');
      if (e.start && e.end && isTimeString(e.start) && isTimeString(e.end)) {
        starts = zonedToUtc(e.date, e.start);
        ends = zonedToUtc(endDate, e.end);
        if (ends <= starts) {
          err('end', endDate === e.date ? 'It ends before it starts. Check AM and PM, or tick “Ends on a different day”.' : 'It ends before it starts.');
        }
      }
    }
  }

  // Place
  let venue: NormalizedEvent['venue'] = null;
  if (e.format !== 'virtual') {
    if (e.venue?.id) venue = { id: e.venue.id };
    else if (e.venue?.name && e.venue.name.length >= 2) {
      venue = {
        new: {
          name: e.venue.name,
          address: e.venue.address || null,
          city: e.venue.city || null,
          postalCode: e.venue.postalCode || null
        }
      };
    } else err('venue', 'Pick the venue, or add it if it is not in the list. If it is not booked yet, type TBD.');
  }
  if (e.format !== 'in_person' && !e.onlineUrl) err('onlineUrl', 'Add the link people will use to join.');

  if (Object.keys(errors).length || !starts || !ends) return { errors };
  return {
    errors,
    value: {
      title: e.title,
      event_type_slug: e.type,
      format: e.format,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      all_day: e.allDay,
      venue,
      online_url: e.format === 'in_person' ? null : e.onlineUrl || null,
      ticket_url: e.ticketUrl || null,
      description: e.description || null,
      image_path: e.imagePath || null
    }
  };
}

export type ParsedSubmission =
  | { ok: true; bot: boolean; value: { organization: SubmissionInput['organization']; submitter: SubmissionInput['submitter']; events: NormalizedEvent[]; turnstileToken?: string } }
  | { ok: false; errors: Errors };

export function parseSubmission(
  raw: unknown,
  ctx: { today: string; typeSlugs: Set<string>; causeSlugs: Set<string>; now?: number }
): ParsedSubmission {
  const parsed = submissionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const input = parsed.data;
  const errors: Errors = {};
  if (!ctx.causeSlugs.has(input.organization.cause)) errors['organization.cause'] = 'Pick the cause that fits best.';
  const events: NormalizedEvent[] = [];
  input.events.forEach((e, i) => {
    const r = normalizeEvent(e, `events.${i}`, ctx);
    Object.assign(errors, r.errors);
    if (r.value) events.push(r.value);
  });
  if (Object.keys(errors).length) return { ok: false, errors };
  const now = ctx.now ?? Date.now();
  const bot = Boolean(input.website) || (input.startedAt !== undefined && now - input.startedAt < 3000);
  return {
    ok: true,
    bot,
    value: { organization: input.organization, submitter: input.submitter, events, turnstileToken: input.turnstileToken }
  };
}
