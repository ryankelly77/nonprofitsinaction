import { NextResponse } from 'next/server';
import { searchOrganizations } from '@/lib/data';

/*
 * Organization suggestions as someone types their own name, the same shape
 * and caching as /api/venues/. Row level security limits this to
 * organizations that already have an approved event, so a name a spam
 * submission left behind is never offered to the next person.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const organizations = await searchOrganizations(q);
  return NextResponse.json({ organizations }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300' } });
}
