import { NextResponse } from 'next/server';
import { getMonthEvents, getMonthHolidays } from '@/lib/data';
import { isMonthString } from '@/lib/time';

/** One month of approved events and holidays, for the date checker as it pages. */
export async function GET(req: Request) {
  const month = new URL(req.url).searchParams.get('month') ?? '';
  if (!isMonthString(month)) return NextResponse.json({ error: 'month must look like 2026-11' }, { status: 400 });
  const [events, holidays] = await Promise.all([getMonthEvents(month, 'fresh'), getMonthHolidays(month, 'fresh')]);
  return NextResponse.json(
    { month, events, holidays },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=120, stale-while-revalidate=600' } }
  );
}
