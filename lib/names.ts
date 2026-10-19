/*
 * The same reduction the database's name_key() makes: letters and digits
 * only, lower case. "NAMI Greater San-Antonio" and "Nami greater san antonio"
 * are one organization.
 */
export function nameKey(value: string): string {
  return value.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
}
