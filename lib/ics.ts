import { venueAddress } from './format.ts';
import { addDays, localParts } from './time.ts';
import type { PublicEvent } from './types.ts';

/*
 * iCalendar (RFC 5545) for one event or a whole feed. Times are written in
 * UTC with a Z, which every calendar app reads correctly and which sidesteps
 * shipping a VTIMEZONE block. All-day events use plain dates.
 */

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Lines longer than 75 octets continue on the next line after a space. */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, 'utf8');
    const limit = out.length === 0 ? 75 : 74;
    if (size + n > limit) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

function utcStamp(instant: string | Date): string {
  return new Date(instant).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function dateStamp(date: string): string {
  return date.replace(/-/g, '');
}

export function eventLines(e: PublicEvent, siteUrl: string): string[] {
  const url = `${siteUrl}/events/${e.slug}/`;
  const where = e.venue ? [e.venue.name, venueAddress(e.venue)].filter(Boolean).join(', ') : e.format === 'virtual' ? 'Online' : '';
  const about = [
    `Hosted by ${e.organization.name}.`,
    e.description ?? '',
    e.ticket_url ? `Tickets and details: ${e.ticket_url}` : '',
    e.online_url ? `Join online: ${e.online_url}` : '',
    url
  ]
    .filter(Boolean)
    .join('\n\n');

  const lines = ['BEGIN:VEVENT', `UID:${e.id}@nonprofitsinaction.org`, `DTSTAMP:${utcStamp(e.published_at ?? e.starts_at)}`];
  if (e.all_day) {
    const s = localParts(e.starts_at).date;
    const last = localParts(new Date(new Date(e.ends_at).getTime() - 1)).date;
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(s)}`, `DTEND;VALUE=DATE:${dateStamp(addDays(last < s ? s : last, 1))}`);
  } else {
    lines.push(`DTSTART:${utcStamp(e.starts_at)}`, `DTEND:${utcStamp(e.ends_at)}`);
  }
  lines.push(`SUMMARY:${escapeText(e.title)}`, `DESCRIPTION:${escapeText(about)}`, `URL:${url}`);
  if (where) lines.push(`LOCATION:${escapeText(where)}`);
  // A parameter value is quoted, and may not itself hold a quote or a control character.
  const cn = e.organization.name.replace(/["\r\n\x00-\x1f]/g, '');
  lines.push(`ORGANIZER;CN="${cn}":mailto:noreply@nonprofitsinaction.org`);
  if (e.status === 'cancelled') lines.push('STATUS:CANCELLED');
  else lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');
  return lines;
}

export function calendarFile(events: PublicEvent[], siteUrl: string, name: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nonprofits in Action//Community Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    'X-WR-TIMEZONE:America/Chicago',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...events.flatMap((e) => eventLines(e, siteUrl)),
    'END:VCALENDAR'
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function icsResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600'
    }
  });
}

/** A Google Calendar "add event" link. */
export function googleCalendarUrl(e: PublicEvent, siteUrl: string): string {
  const dates = e.all_day
    ? `${dateStamp(localParts(e.starts_at).date)}/${dateStamp(addDays(localParts(e.starts_at).date, 1))}`
    : `${utcStamp(e.starts_at)}/${utcStamp(e.ends_at)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates,
    ctz: 'America/Chicago',
    details: `Hosted by ${e.organization.name}. ${siteUrl}/events/${e.slug}/`,
    location: e.venue ? [e.venue.name, venueAddress(e.venue)].filter(Boolean).join(', ') : ''
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** An Outlook.com "add event" link. */
export function outlookCalendarUrl(e: PublicEvent, siteUrl: string): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    startdt: new Date(e.starts_at).toISOString(),
    enddt: new Date(e.ends_at).toISOString(),
    allday: e.all_day ? 'true' : 'false',
    body: `Hosted by ${e.organization.name}. ${siteUrl}/events/${e.slug}/`,
    location: e.venue ? [e.venue.name, venueAddress(e.venue)].filter(Boolean).join(', ') : ''
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
