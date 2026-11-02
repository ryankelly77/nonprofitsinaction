import { NextResponse } from 'next/server';
import { getDayEvents, getDayHolidays } from '@/lib/data';
import { isDateString } from '@/lib/time';

/** What is already listed on one San Antonio date. Used by the submit form as dates are typed. */
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date') ?? '';
  if (!isDateString(date)) return NextResponse.json({ error: 'date must look like 2026-11-07' }, { status: 400 });
  const [events, holidays] = await Promise.all([getDayEvents(date), getDayHolidays(date)]);
  return NextResponse.json({ date, events, holidays }, { headers: { 'Cache-Control': 'no-store' } });
}
