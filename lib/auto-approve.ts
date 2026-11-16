/*
 * Whether a listing may go up without anybody reading it.
 *
 * Kept apart from lib/moderation.ts, which reaches the database and the mail
 * server, so the decision can be read and tested on its own. Returns why it
 * will not publish, or null to publish.
 */

export type AutoApproveRefusal = 'not-pending' | 'not-trusted' | 'open-question' | 'unread-name';

export function autoApproveRefusal(input: {
  moderation: string;
  organization: { auto_approve: boolean; verified: boolean } | null;
  venue: { verified: boolean } | null;
  /** Whether a name here looks like one already listed. */
  openQuestions: boolean;
}): AutoApproveRefusal | null {
  if (input.moderation !== 'pending') return 'not-pending';
  if (!input.organization?.auto_approve) return 'not-trusted';
  if (input.openQuestions) return 'open-question';
  /*
   * The one thing trust does not cover is a name nobody has read. An
   * organization can be entirely reliable and still type "Wittie Museum", and
   * publishing that would both put it on the calendar and offer it to the
   * next submitter as a venue to pick. So an unread name waits, even with
   * nothing to compare it against.
   */
  if (!input.organization.verified || (input.venue && !input.venue.verified)) return 'unread-name';
  return null;
}
