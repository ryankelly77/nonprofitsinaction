import { getEventsForOrganization, getOrganizationBySlug } from '@/lib/data';
import { SITE_URL } from '@/lib/env';
import { calendarFile, icsResponse } from '@/lib/ics';

export const revalidate = 900;

/** One organization's events, as a feed a calendar app can subscribe to. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) return new Response('Not found', { status: 404 });
  const since = Date.now() - 90 * 86_400_000;
  const events = (await getEventsForOrganization(org.id)).filter((e) => Date.parse(e.ends_at) >= since);
  return icsResponse(calendarFile(events, SITE_URL, `${org.name} · Nonprofits in Action`), `${org.slug}.ics`);
}
