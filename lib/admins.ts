/*
 * The rules about who may change the admin list, kept apart from the database
 * so they can be read and tested on their own.
 *
 * Two things must stay true however the buttons are clicked: the calendar is
 * never left without a super admin, and nobody removes or demotes themselves
 * by accident and locks themselves out of the page that would undo it.
 */

export interface AdminRow {
  email: string;
  super_admin: boolean;
}

export type AdminRefusal = 'not-super' | 'last-super' | 'self' | 'unknown' | 'already';

/** Why this change is refused, or null if it is allowed. */
export function refuseRemove(admins: AdminRow[], actor: string, target: string): AdminRefusal | null {
  const me = admins.find((a) => a.email === actor);
  if (!me?.super_admin) return 'not-super';
  if (actor === target) return 'self';
  const row = admins.find((a) => a.email === target);
  if (!row) return 'unknown';
  if (row.super_admin && admins.filter((a) => a.super_admin).length <= 1) return 'last-super';
  return null;
}

export function refuseSetSuper(admins: AdminRow[], actor: string, target: string, next: boolean): AdminRefusal | null {
  const me = admins.find((a) => a.email === actor);
  if (!me?.super_admin) return 'not-super';
  const row = admins.find((a) => a.email === target);
  if (!row) return 'unknown';
  if (row.super_admin === next) return 'already';
  // Standing down is allowed, but not by the last one holding the role: the
  // page that grants it is the page only a super admin can open.
  if (!next && admins.filter((a) => a.super_admin).length <= 1) return 'last-super';
  return null;
}

export function refuseInvite(admins: AdminRow[], actor: string, email: string): AdminRefusal | null {
  const me = admins.find((a) => a.email === actor);
  if (!me?.super_admin) return 'not-super';
  if (admins.some((a) => a.email === email)) return 'already';
  return null;
}

const SAID: Record<AdminRefusal, string> = {
  'not-super': 'Only a super admin can change who reviews listings.',
  'last-super': 'Make somebody else a super admin first. The calendar cannot be left without one.',
  self: 'You cannot remove yourself. Ask another super admin.',
  unknown: 'That address is not on the admin list.',
  already: 'That is already the case.'
};

export function sayRefusal(why: AdminRefusal): string {
  return SAID[why];
}

/*
 * How many digits the emailed sign-in code has. This has to match the
 * project's Supabase auth setting, mailer_otp_length, which is where the code
 * is actually generated; it is said here so the form, the label and the copy
 * cannot drift from each other. Supabase still has the final say on whether a
 * code is right, so a mismatch here only refuses early, never wrongly.
 */
export const CODE_LENGTH = 8;

/*
 * An address is usable if it looks like an address at all. The real check is
 * that the code has to arrive and be typed back, which no typo survives.
 */
export function tidyEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
