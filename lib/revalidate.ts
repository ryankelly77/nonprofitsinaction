import 'server-only';
import { revalidatePath } from 'next/cache';

/*
 * The public pages are built ahead of time and refreshed every few minutes.
 * When an admin approves, edits or cancels anything, or a submitter changes a
 * live listing, everything is refreshed at once instead, so the change shows
 * on the next page view. The calendar is small; refreshing all of it is
 * cheaper than tracking which pages a change touches.
 */
export function refreshPublicPages(): void {
  revalidatePath('/', 'layout');
}
