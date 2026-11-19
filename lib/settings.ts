/*
 * The settings an admin can change in the admin, and what their stored values
 * mean.
 *
 * Rules only, no database: lib/settings-store.ts does the reading and
 * writing. Split that way for the same reason lib/submission.ts is, which is
 * that a rule worth trusting is a rule worth testing, and a module that
 * reaches a database cannot be imported by the test runner at all.
 */

export type SettingKey = 'email_submitters';

/**
 * Whether a stored value means on. Only the one word does.
 *
 * Nothing, an empty string, "true", "yes", "1", "On" with a capital, "on"
 * with a space: all off. A half-written value must never be read as
 * permission to start emailing people, and neither must a value that could
 * not be read at all, which arrives here as null.
 */
export function meansOn(value: string | null): boolean {
  return value === 'on';
}

/** What to store for a yes or a no, so only one place decides the spelling. */
export function onOff(on: boolean): string {
  return on ? 'on' : 'off';
}
