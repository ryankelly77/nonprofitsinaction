import { getUpcomingEvents } from '@/lib/data';
import { SITE_URL } from '@/lib/env';
import { calendarFile, icsResponse } from '@/lib/ics';

export const revalidate = 900;

/*
 * The whole calendar as a subscription feed. Add
 * webcal://nonprofitsinaction.org/calendar.ics to Apple, Google or Outlook and
 * new listings appear on their own. Recent past events stay in the feed for a
 * month so a subscriber's calendar does not lose them the day after.
 */
export async function GET() {
  const events = await getUpcomingEvents({ after: new Date(Date.now() - 30 * 86_400_000), limit: 1000 });
  return icsResponse(calendarFile(events, SITE_URL, 'San Antonio Nonprofit Events'), 'nonprofits-in-action.ics');
}
