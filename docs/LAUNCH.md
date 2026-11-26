# Launch notes

What has to happen before sanonprofitcalendar.org points here, what changed on
purpose, and what still needs a decision. Written October 19, 2026, and
rewritten in November when the calendar was renamed.

**Two domains.** sanonprofitcalendar.org is the address from launch on.
nonprofitsinaction.org is the old one: it keeps working, and 301s to the new
address with the path kept, so every link and search result that points at an
old event page still lands on that event. Nothing is retired; the old domain
is a permanent redirect, not a holding page.

The site is renamed in the code already. The domain is not registered yet, so
every step below that names it is still to do, and nothing in this repo points
at it: `NEXT_PUBLIC_SITE_URL` and its fallback, `content/redirects.json` and
`trailingSlash` are untouched, and mail still sends from the old domain.
Step 8 is the whole list, in order.

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
   `https://sanonprofitcalendar.org`, add
   `https://sanonprofitcalendar.org/admin/auth/callback/` and the Vercel
   preview pattern (`https://*.vercel.app/admin/auth/callback/`) to the
   redirect URLs, and set custom SMTP (Mailgun's SMTP credentials work).
   Supabase's built-in mailer only sends a few sign-in emails an hour. Until
   the domain is registered, the Vercel URL goes in both places instead; step
   8 is where they change over.

   The sign-in email is Supabase's own template, not this repo's, so it still
   says the old name. Its subject and the SMTP sender name both have to be
   edited by hand in the Supabase dashboard.

3. **Environment variables** in Vercel, from `.env.local.example`. Required:
   the three Supabase values, `NEXT_PUBLIC_SITE_URL`, and the Mailgun values.
   Without Mailgun in production, submitters get no confirmation and no edit
   link. `SLACK_WEBHOOK_URL` and the two Turnstile keys are optional but worth
   setting. `GOOGLE_PLACES_API_KEY` is optional too: with it, the venues
   page can fill in a missing street address from the venue's name instead
   of somebody looking each one up in another tab. Enable the Places API
   (New) on a Google Cloud project, restrict the key to that API, and keep
   it server-side. Leave `EMAIL_SUBMITTERS` unset until step 9: working through the
   imported listings is not news to the people who submitted them to the old
   site, and approving one would otherwise email them that it is live. Every
   admin page says so while it is off.

4. **Mailgun.** A sending domain with **every** record Mailgun asks for at the
   DNS host: SPF, DKIM, the tracking CNAME, **and the two MX records**
   (`mxa.mailgun.org` and `mxb.mailgun.org`, both priority 10).
   nonprofitsinaction.org (or a subdomain) is what is verified today, and
   what everything sends from. The new domain needs its own verified sending
   domain before any address on it can send, which is why `EMAIL_FROM` keeps
   the old address until step 8.

   **The MX records are not optional, and leaving them out fails in a way
   that looks like something else.** They are easy to skip, because we only
   send from this domain and never receive on it, and Mailgun will report the
   domain "active" without them. But every message Mailgun sends carries an
   envelope sender on the sending domain (`bounce+...@mg.example.org`), and a
   receiving mail server that checks whether that domain resolves will refuse
   the message outright:

   ```
   5.1.8 <bounce+...@mg.nonprofitsinaction.org>: Sender address rejected: Domain not found
   ```

   That is not a spam score or a junk folder. The mail never arrives, and
   nothing in this application can tell: Mailgun accepts the message, then
   reports the failure minutes later in its own logs. It bites unevenly,
   which is what makes it confusing to chase: plenty of providers do not
   check, so the same email reaches one person and never reaches another at a
   stricter host. In November 2026 it reached nobody at tncouncil.org, which
   is most of the people who review listings, and read for days as a broken
   sign-in.

   While there: **the domain in the From address needs MX records too** if
   anybody is to reply to it. Several of the emails this calendar sends ask
   the organizer to reply, and a reply only goes somewhere if the From
   domain can receive mail.

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
     "Browse by cause" finds them, and merge the duplicates the report lists
     the way you do for venues. "Needs a check" there should be empty or
     nearly so: the import marks what it brings in as verified, and anything
     left is an organization whose only event is still waiting for review.

7. **Freeze and final import.** On cutover day, turn off the Gravity Forms
   listing form on WordPress, export again and run the import again. It adds
   only what was listed since the first run and leaves everything already
   imported (and any admin edits to it) alone.

   **The export has to come from `scripts/npia-export.php`.** The import
   reads that file's shape and nothing else, so an export written any other
   way does not load, and the November 2026 round found out what it costs to
   work around one: its timestamps were San Antonio wall clock where this one
   is UTC, and it left out the Gravity Forms entries. Those entries are not a
   detail. They hold the date and time each submitter typed, which is what
   every imported start time is checked against (218 of them on the first
   run, against six by hand without them), and they are how a submission is
   matched to the one already in the database. Without them every event falls
   through to the submitter in its post meta, including the ones imported
   months ago, which makes a duplicate submission row for every listing on
   the calendar. If you hand the export to an agent, give it the command at
   the top of `scripts/npia-export.php` rather than letting it write its own.

8. **The domain.** sanonprofitcalendar.org becomes the address and
   nonprofitsinaction.org becomes the redirect. In this order, because each
   step needs the one above it to be true already:

   1. **Register sanonprofitcalendar.org and add it as the Vercel domain**
      for this project, as the production domain. Point its apex and `www` at
      Vercel. Leave the old domain's MX and TXT records alone: mail and the
      Mailgun verification still live on it.
   2. **Set `NEXT_PUBLIC_SITE_URL`** to `https://sanonprofitcalendar.org` in
      Vercel and redeploy. Everything the site says about itself reads this:
      canonical tags, the sitemap, the structured data, and every link inside
      an email. Until it changes, the new domain serves pages that tell
      Google the old one is canonical.
   3. **Update Supabase Authentication**: the Site URL and the
      `/admin/auth/callback/` redirect URL, to the new domain. Admin sign-in
      breaks on the new domain until this is done, so do it in the same
      sitting.
   4. **Set up the Mailgun sending domain for sanonprofitcalendar.org** and
      add every record it asks for, the two MX records included, for the
      reason in step 4. Wait for Mailgun to verify it. Nothing
      about email changes until it has.
   5. **Then, and only then, switch the sending addresses.** There are
      three, in two different places, and the third is easy to miss:
      - `EMAIL_FROM` in Vercel, for everything this application sends.
      - The ICS organizer address in `lib/ics.ts`.
      - **Supabase's own SMTP sender**, under Project Settings,
        Authentication, SMTP. The sign-in code is Supabase's email, not
        this application's, so it carries whatever address is set there and
        is unaffected by `EMAIL_FROM`. Miss it and admin sign-in keeps
        sending from the old domain after everything else has moved.

      Sending from an unverified domain does not bounce politely; it lands
      in spam, and the mail this calendar sends is how organizers get the
      only link they have to their own listing.

   **Keep nonprofitsinaction.org pointed at Vercel** as a redirect domain,
   with the path kept, so `/events/<slug>/` on the old domain reaches
   `/events/<slug>/` on the new one. Vercel's domain redirect does this;
   do not replace it with a page that says "we moved".

   **The ICS UIDs stay on nonprofitsinaction.org** whatever the domain does.
   A UID is an event's identity to a calendar app, not an address, and
   changing one makes every subscribed calendar show that event twice: once
   under the old id and once under the new. They are opaque strings that
   never resolve to anything, and they are meant to be permanent.

9. **Start emailing submitters.** Tick "Email submitters" under
   Settings, on the Email tab, and save. No deploy: it is a setting now
   rather than the `EMAIL_SUBMITTERS` environment variable it used to be, so
   it takes effect on the next page view. From here a new listing gets its
   confirmation and its private edit link, and approving or turning one down
   tells the person who sent it. Do this after the final import, not before,
   or the import's own approvals will email people about events they listed
   months ago. The warning on every admin page goes away when it is on, which
   is the quickest way to check it took.

10. **After cutover.** Add sanonprofitcalendar.org as its own property in
   Search Console and Bing and submit `/sitemap.xml` there. Keep the
   nonprofitsinaction.org property too: it is how you watch the old
   address's results hand over to the new one, and a 301 takes weeks to be
   followed everywhere. Watch Vercel's logs for 404s for two weeks and add a
   line to `content/redirects.json` for anything real. Keep the WP Engine
   install for 30 days, then cancel it.

## 2. What changed on purpose

- **The name.** The calendar is the SA Nonprofit Calendar, not Nonprofits in
  Action. The footer says "Formerly Nonprofits in Action" and the structured
  data carries the old name as `alternateName`, so a search engine with years
  of this calendar indexed can tell it is the same site rather than a new one
  that looks similar. Everything the site says about itself reads
  `content/site.ts`, so there is one place to change it.

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
- **Venues and organizations.** Only ones an admin has verified are suggested
  on the form, so a name nobody has read is never handed to the next person.
  A new one typed in by hand is checked when its event is approved. Both
  arrive from the import already verified, because they were published on the
  WordPress site.
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
