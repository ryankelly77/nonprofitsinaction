import { NextResponse } from 'next/server';
import { searchVenues, similarVenues } from '@/lib/data';

/** Venue suggestions as someone types. Only venues an admin has verified are offered. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const [venues, similar] = await Promise.all([searchVenues(q), similarVenues(q)]);
  // "similar" is what the letters typed do not reach: "Wittie" against "Witte".
  const didYouMean = similar.filter((s) => !venues.some((v) => v.id === s.id));
  return NextResponse.json({ venues, didYouMean }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300' } });
}
