# Working in this repo

This is the San Antonio nonprofit community calendar at nonprofitsinaction.org.
It replaced a WordPress site running EventON and Gravity Forms. Read
`README.md` for the layout and `docs/LAUNCH.md` for what is left before the
domain moves.

## Before you commit

Run `npm run check`. It runs the tests, lint, a production build and the type
check. All four must pass.

## Branches and installs

- Never commit on `main` and never push to it. Cut a branch from
  `origin/main`, open a pull request, and the owner merges it.
- One session per working copy. Before every commit, look at `git status` and
  `git branch --show-current`. If the branch is not the one you made for this
  task, or files you did not touch have changed, stop and say so.
- Install with `npm ci`, and install before starting `next dev`.
- `next dev` writes an `AGENTS.md` when it sees a coding agent. Git ignores it
  on purpose. Do not commit it.

## Rules that keep the calendar right

- **Time.** Every timestamp in the database is an instant (timestamptz, UTC).
  People type and read San Antonio time. Convert only through `lib/time.ts`,
  which takes the zone explicitly. Never use the server's local time (Vercel
  runs in UTC), never add a fixed offset, never store a wall-clock time as if
  it were UTC. `tests/time.test.ts` holds real events and both DST changes; a
  change that breaks one of them is wrong.
- **Who sees what is decided in row level security**
  (`supabase/migrations`). The anon key reads approved events and what they
  point to, and nothing else. All writes go through the service role on the
  server, after validation. Do not add a public insert or update policy.
- **Private details stay in `submissions`.** Do not add submitter names or
  emails to `events`; that table is public once approved.
- **Every write to an event logs a row in `event_changes`** and calls
  `refreshPublicPages()` if the event is live. Use the helpers in
  `lib/moderation.ts`, `lib/edit.ts` and `lib/listing.ts` rather than writing
  to `events` directly.
- **Validation lives in `lib/submission.ts`** and runs on the server. The
  form's own checks are a convenience.
- **Old addresses keep working.** Event slugs from WordPress were kept; any
  that changed are in `events.legacy_slugs` and redirect. Page-level
  redirects are in `content/redirects.json`. Keep `trailingSlash: true` in
  `next.config.ts`.
- Schema changes are new files in `supabase/migrations/`, never edits to one
  that has run in production. Update `lib/types.ts` with them.

## Copy

- No em dashes in new copy. US English.
- Never invent a number, a partner, a quote or a capability. Facts about the
  calendar's history and partners are in `content/site.ts` and came from the
  old site.

## Design

One stylesheet for the public site, `components/site.module.css`. Display
type is Bricolage Grotesque, body is Public Sans, small labels are IBM Plex
Mono in capitals (all served from `app/fonts/`). Teal #0E5650 is the brand and
action color; amber #F4A62A marks "something is on this date" and is the one
accent on dark sections. Body text is never lighter than #4B5B58 on white.
