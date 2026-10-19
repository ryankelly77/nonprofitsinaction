import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;

/*
 * A one-time upload slot for an event flyer. The browser sends the file
 * straight to storage with the token returned here, so large images never
 * pass through this site's functions (which cap request bodies at 4.5 MB).
 * The path is chosen here, never by the browser.
 */
export async function POST(req: Request) {
  // Only this site's own pages ask for upload slots. Not a defense against a
  // determined script, but it keeps casual reuse of the endpoint out; the
  // bucket's 5 MB and image-only limits hold either way.
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(req.url).host) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }
  let body: { type?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const ext = body.type ? TYPES[body.type] : undefined;
  if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG or WebP image.' }, { status: 400 });
  if (!body.size || body.size > MAX_BYTES) return NextResponse.json({ error: 'Images can be up to 5 MB.' }, { status: 400 });

  const month = new Date().toISOString().slice(0, 7);
  const path = `submissions/${month}/${randomUUID()}.${ext}`;
  const { data, error } = await serviceClient().storage.from('event-images').createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: 'Uploads are not available right now.' }, { status: 503 });
  return NextResponse.json({ path, token: data.token }, { headers: { 'Cache-Control': 'no-store' } });
}
