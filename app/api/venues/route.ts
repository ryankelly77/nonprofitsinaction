import { NextResponse } from 'next/server';
import { searchVenues } from '@/lib/data';

/** Venue suggestions as someone types. Only venues an admin has verified are offered. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const venues = await searchVenues(q);
  return NextResponse.json({ venues }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300' } });
}
