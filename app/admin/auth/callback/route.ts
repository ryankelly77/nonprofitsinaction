import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/supabase/session';

/* Where the magic link lands: trade its code for a session, then go to the queue. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (code) {
    const auth = await sessionClient();
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/admin/', url.origin));
  }
  return NextResponse.redirect(new URL('/admin/login/?expired=1', url.origin));
}
