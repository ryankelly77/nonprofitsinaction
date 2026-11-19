/*
 * Submission rows the import left behind that nothing points at.
 *
 *   npm run submissions:orphans            # list them, change nothing
 *   npm run submissions:orphans -- --delete # remove them
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * .env.local.
 *
 * Why these exist. A submission is how somebody reaches their own listing:
 * the private edit link hangs off it, and /manage/ re-sends a link by looking
 * up the address. The import makes one per listing it brings in, from the
 * Gravity Forms entry the event came from, or failing that from the
 * submitter in the event's own post meta.
 *
 * An event already imported is skipped on a later run, but the submission
 * loops are not: they run over every row the export produced. So when an
 * export arrives without its Gravity Forms entries, every event takes the
 * post-meta path, including ones imported months ago that already have a
 * submission from their entry, and the second one is written with nothing
 * pointing at it. The November 2026 export did this 173 times. A normal
 * export leaves a handful, for events imported from the other kind.
 *
 * What it will not touch, because each of these is somebody's way in:
 *
 *   - a submission an event points at, whatever state that event is in
 *   - one made through the form or by an admin, rather than by the import
 *   - one carrying a Gravity Forms entry id, which is the record of a real
 *     submission on the old site even if its event was since rejected
 *   - one that has ever had a link issued, since that link is in somebody's
 *     inbox and deleting the row is what breaks it
 */
import fs from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DELETE = process.argv.includes('--delete');

if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in .env.local).');
  process.exit(1);
}
const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

/** Every row of a table, a page at a time: these lists outgrow one request. */
async function all<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) return out;
  }
}

interface Submission {
  id: string;
  submitter_name: string;
  submitter_email: string;
  source: string;
  legacy_entry_id: number | null;
  manage_token_hash: string | null;
  manage_link_sent_at: string | null;
  created_at: string;
}

const submissions = await all<Submission>(
  'submissions',
  'id, submitter_name, submitter_email, source, legacy_entry_id, manage_token_hash, manage_link_sent_at, created_at'
);
const events = await all<{ id: string; submission_id: string | null }>('events', 'id, submission_id');
const pointedAt = new Set(events.map((e) => e.submission_id).filter((id): id is string => id !== null));

const orphans = submissions.filter(
  (s) =>
    s.source === 'eventon-import' &&
    s.legacy_entry_id === null &&
    s.manage_token_hash === null &&
    s.manage_link_sent_at === null &&
    !pointedAt.has(s.id)
);

console.log(`\n${submissions.length} submissions, ${pointedAt.size} with a listing pointing at them.`);
console.log(`${orphans.length} left by the import with nothing pointing at them.`);

if (orphans.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

/*
 * By address rather than one line each: the interesting thing is which people
 * have a stray row, and the import makes one per listing, so a name repeats.
 */
const byEmail = new Map<string, number>();
for (const s of orphans) byEmail.set(s.submitter_email, (byEmail.get(s.submitter_email) ?? 0) + 1);
console.log('');
for (const [email, n] of [...byEmail].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  console.log(`  ${email}${n > 1 ? `  (${n} rows)` : ''}`);
}

if (!DELETE) {
  console.log('\nNothing was changed. Add --delete to remove them.');
  process.exit(0);
}

/*
 * By id, in batches, so what is removed is exactly what was counted above
 * and not whatever a filter happens to match a moment later.
 */
let gone = 0;
const ids = orphans.map((s) => s.id);
for (let i = 0; i < ids.length; i += 50) {
  const { data, error } = await db
    .from('submissions')
    .delete()
    .in('id', ids.slice(i, i + 50))
    .select('id');
  if (error) throw new Error(`delete: ${error.message}`);
  gone += (data ?? []).length;
}

// Read back rather than trust the count: the one thing that must not have
// happened is a listing losing the submission it was reached through.
const left = await all<{ id: string }>('submissions', 'id');
const stillThere = new Set(left.map((s) => s.id));
const broken = events.filter((e) => e.submission_id && !stillThere.has(e.submission_id));

console.log(`\nDeleted ${gone} of ${ids.length}. ${left.length} submissions left.`);
console.log(
  broken.length === 0
    ? 'Every listing still has the submission it was reached through.'
    : `WARNING: ${broken.length} listings now point at a submission that is gone: ${broken.map((e) => e.id).join(', ')}`
);
if (broken.length > 0) process.exit(1);
