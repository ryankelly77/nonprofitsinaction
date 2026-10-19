import { permanentRedirect } from 'next/navigation';
import { publicClient } from '@/lib/supabase/public';

/*
 * EventON's "add to calendar" links looked like /export-events/118434_0/?key=...
 * where the number is the WordPress post. Anyone who saved one is sent to the
 * same event's calendar file here.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number.parseInt(id, 10);
  const db = publicClient('fresh');
  if (db && Number.isFinite(postId)) {
    const { data } = await db.from('events').select('slug').eq('legacy_post_id', postId).limit(1);
    if (data?.[0]) permanentRedirect(`/events/${data[0].slug}/calendar.ics`);
  }
  permanentRedirect('/calendar.ics');
}
