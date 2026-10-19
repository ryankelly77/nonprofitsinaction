# Launch notes

What has to happen before nonprofitsinaction.org points here, what changed on
purpose, and what still needs a decision. Written October 19, 2026.

## 1. Before the domain points here

1. **GitHub and Vercel.** New Vercel project from
   `ryankelly77/nonprofitsinaction`, production branch `main`. Standard
   Next.js build; nothing else to configure.

2. **Supabase.** New project. Then, from this repo:
   ```
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   That creates every table, the row level security and the `event-images`
   storage bucket. Add the people who review listings:
   ```sql
   insert into admins (email, name) values ('ryan@pearanalytics.com', 'Ryan Kelly');
   ```
   In Authentication settings: set the Site URL to
   `https://nonprofitsinaction.org`, add
   `https://nonprofitsinaction.org/admin/auth/callback/` and the Vercel
   preview pattern (`https://*.vercel.app/admin/auth/callback/`) to the
   redirect URLs, and set custom SMTP (Mailgun's SMTP credentials work).
   Supabase's built-in mailer only sends a few sign-in emails an hour.

3. **Environment variables** in Vercel, from `.env.local.example`. Required:
   the three Supabase values, `NEXT_PUBLIC_SITE_URL`, and the Mailgun values.
   Without Mailgun in production, submitters get no confirmation and no edit
   link. `SLACK_WEBHOOK_URL` and the two Turnstile keys are optional but worth
   setting.

4. **Mailgun.** A sending domain for nonprofitsinaction.org (or a
   subdomain), with its SPF and DKIM records added at the DNS host.

5. **Import.** Run `scripts/npia-export.php` on the live install (the command
   is at the top of the file), then:
   ```
   npm run import:eventon -- npia-export.json
   ```
   Read `import-report.json`. It says how EventON stored this site's times,
   how many events could be checked against what their submitters typed, and
   which ones were corrected. If the reading looks wrong, stop and look before
   going further. Then:
   ```
   npm run import:eventon -- npia-export.json --apply --images
   ```
   `--images` copies flyers out of WordPress into Supabase storage, so it has
   to run while the old site is still up.

   **The first export (October 19) came out clean.** All 218 events that
   could be checked against what their submitters typed were stored the same
   way, with no disagreements, so no times were changed. Six known events
   were checked against the live site by hand and match. The import gives
   219 events (74 still upcoming), 123 organizations, 106 venues and 155
   holidays. It skips 70 events from 2025 that have no organizer at all
   (the CSV batch loaded in September 2025; all are past).

6. **Clean up after the import,** in `/admin/`:
   - "Needs a check": every event whose time was corrected or could not be
     checked, every event without a venue or a type. From the first export
     that is 29 listings with no venue (none was entered on the form) and
     one with no type.
   - Duplicate listings: the report's `possible_duplicate_events` (the first
     export has one, "Whole Child Whole Community Conference" listed twice
     on Nov 10). Reject the extra one.
   - "Venues": merge duplicates. The report lists names that are nearly
     identical (Witte Museum and Wittie Museum, Whitley Event Center and The
     Whitley Event Center). The old list also has pairs no comparison will
     catch, such as Shrine Auditorium and San Antonio Shrine Auditorium, or
     the two San Antonio Marriott Rivercenter entries; look down the list
     once. TBD, To Be Announced!, Online, Virtual and the like are not
     imported as venues at all.
   - "Organizations": give a cause to any the report lists without one, so
     "Browse by cause" finds them.

7. **Freeze and final import.** On cutover day, turn off the Gravity Forms
   listing form on WordPress, export again and run the import again. It adds
   only what was listed since the first run and leaves everything already
   imported (and any admin edits to it) alone.

8. **DNS.** Point the apex and `www` at Vercel. Leave MX and TXT records
   alone.

9. **After cutover.** Submit `/sitemap.xml` in Search Console and Bing.
   Watch Vercel's logs for 404s for two weeks and add a line to
   `content/redirects.json` for anything real. Keep the WP Engine install for
   30 days, then cancel it.

## 2. What changed on purpose

- **Holidays are no longer events.** The old site listed 155 US holidays
  (2026 to 2030) as EventON events. They are now their own list: shown on
  the month view, in the date check and in the submit form ("November 26 is
  Thanksgiving"), never in event listings or feeds.

- **Nothing is public until approved.** Every new listing waits in the
  review queue. Approving it emails the submitter.
- **No organizer accounts.** Each submission gets a private edit link by
  email instead, and a lost link can be re-sent from `/manage/`. Imported
  events are matched to their Gravity Forms entry, so organizers who listed
  on the old site can get links for those too. Edits to a live listing go
  live at once and the admins are told what changed.
- **Canceled and postponed events stay on the calendar,** labeled, so
  planners can see the date has opened up.
- **Event types.** The old eight are kept and "Dinner" (used in the data but
  missing from the old form) is added, along with "Conference / workshop",
  "Volunteer / info session" and "Other". Several old listings were filed
  under a type that did not fit because there was nothing closer.
- **Venues.** Only venues an admin has verified are suggested on the form.
  A new one typed in by hand is checked when its event is approved.
- **Search engines.** The old home, about, calendar and listing pages sent
  `noindex, nofollow`. Nothing public does now.
- **The spam link.** The old home page linked "Shaddersagent" to an outside
  login site. It was in the WordPress page content and was not carried over.

## 3. Still needs a decision or a file

- **Who reviews listings** and who gets the new-listing emails (the `admins`
  table, `notify` column).
- **The logo.** `components/Logo.tsx` and `app/icon.svg` are stand-ins. The
  current logo file from WordPress
  (`wp-content/uploads/2026/02/NPIA-New-Logo.png`) should replace them.
- **Partner logos.** The partner strip shows names only.
- **Social accounts.** The old footer's icons linked nowhere, so none are
  shown. Add real addresses to `content/site.ts`.
- **Analytics.** No tag is installed yet. Send the GA4 or Tag Manager ID.
- **Unused uploads.** A flyer uploaded on a form that is never submitted
  stays in storage. Harmless at this size; a monthly cleanup job can come
  later.
