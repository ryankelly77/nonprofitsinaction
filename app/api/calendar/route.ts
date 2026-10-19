import { NextResponse } from 'next/server';
import { getMonthEvents } from '@/lib/data';
import { isMonthString } from '@/lib/time';

/** One month of approved events, for the date checker as it pages. */
export async function GET(req: Request) {
  const month = new URL(req.url).searchParams.get('month') ?? '';
  if (!isMonthString(month)) return NextResponse.json({ error: 'month must look like 2026-11' }, { status: 400 });
  const events = await getMonthEvents(month, 'fresh');
  return NextResponse.json(
    { month, events },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600' } }
  );
}
