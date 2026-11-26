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

/*
 * The admin's own pages, after something only an admin sees changes: who
 * reviews listings, a flag cleared, a standard answer edited.
 *
 * Worth its own call rather than borrowing the one above, which says it is
 * refreshing the public site and would not be true. But it is needed, and
 * leaving it out is not a small bug: an admin removed somebody from the admin
 * list, the row stayed on the screen because nothing told the page to read
 * again, she took that to mean it had not worked, and the person she had
 * actually removed then could not sign in. A write nobody can see is worse
 * than a write that fails.
 */
export function refreshAdminPages(): void {
  revalidatePath('/admin', 'layout');
}
