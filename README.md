# Nonprofits in Action

San Antonio's shared calendar of nonprofit events. Next.js on Vercel, data in
Supabase. It replaces the WordPress site (EventON for the calendar, Gravity
Forms for submissions).

What it does that the old site did not:

- **Date check.** Pick a day and see what is already booked, on the home
  page, at `/calendar/`, and live in the submit form as a date is typed.
- **Review before publish.** Submissions wait in `/admin/` with any same-day
  clashes shown next to them.
- **Private edit links.** Every submitter gets a link to change, postpone or
  cancel their own listing. No accounts. Lost links are re-sent from
  `/manage/`.
- **Calendar feeds.** `/calendar.ics` for the whole calendar, one per
  organization, one per event, plus Google and Outlook buttons.
- **Search engines.** Every event page carries schema.org Event data, there is
  a sitemap, and nothing public is noindexed.
- **Clean venues.** Venue type-ahead from verified venues only, and admin tools
  to fix and merge duplicates.

## Layout

```
app/(site)/          public pages: home, events, event, calendar, organization, submit, manage, about
app/admin/           review queue, event editor, venues, organizations (magic-link sign-in)
app/api/             calendar month, one day, venue search, image upload slots
app/calendar.ics/    the subscription feed
components/          shared UI; site.module.css is the one stylesheet
content/             site-wide words and the old-address redirects
lib/time.ts          the only place wall-clock time and instants meet
lib/submission.ts    every rule a listing must pass
lib/moderation.ts    approve, reject, cancel, merge
lib/eventon.ts       reading the WordPress export
scripts/             import-eventon.ts, the one-time (re-runnable) import
supabase/            migrations and local seed data
tests/               node:test, run with npm test
```

## Local work

```
npm ci
cp .env.local.example .env.local      # fill in the Supabase values
npm run dev
```

For a local database, the Supabase CLI: `npx supabase init` (once), then
`npx supabase start` and `npx supabase db reset`, which applies
`supabase/migrations` and loads `supabase/seed.sql` (six real events and one
made-up pending one). Set `LOCAL_ADMIN_EMAIL` to use `/admin` without email.

## Checks

`npm run check` runs the tests, lint, build and type check. The tests cover
time conversion against real events and both DST changes, the submission
rules, calendar file formatting, and the EventON import against a sample
export.

## Importing from WordPress

`scripts/npia-export.php` produces one JSON file from the live
site. Then:

```
npm run import:eventon -- npia-export.json            # dry run, writes import-report.json
npm run import:eventon -- npia-export.json --apply --images
```

Read `import-report.json` before `--apply`. The export and the report hold
submitters' emails; both are git-ignored and should stay out of the repo.
