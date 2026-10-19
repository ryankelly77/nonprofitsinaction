import { getEventBySlug } from '@/lib/data';
import { SITE_URL } from '@/lib/env';
import { calendarFile, icsResponse } from '@/lib/ics';

export const revalidate = 600;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { event } = await getEventBySlug(slug);
  if (!event) return new Response('Not found', { status: 404 });
  return icsResponse(calendarFile([event], SITE_URL, event.title), `${event.slug}.ics`);
}
