-- Local development data only. `supabase db reset` loads it; production never
-- does. The six approved events are real listings copied from the WordPress
-- calendar in October 2026, with their times converted to UTC by hand (they
-- double as the time-zone fixtures in tests/time.test.ts). The pending one is
-- made up and says so.

insert into public.organizations (id, name, slug, cause_slug, sector, website) values
  ('00000000-0000-4000-a000-000000000001', 'The Animal Defense League of Texas', 'the-animal-defense-league-of-texas', 'animals', 'nonprofit', null),
  ('00000000-0000-4000-a000-000000000002', 'NAMI Greater San Antonio', 'nami-greater-san-antonio', 'mental-health', 'nonprofit', null),
  ('00000000-0000-4000-a000-000000000003', 'Child Advocates San Antonio', 'child-advocates-san-antonio', 'social-services', 'nonprofit', 'https://casa-satx.org'),
  ('00000000-0000-4000-a000-000000000004', 'Care Warriors Inc.', 'care-warriors-inc', 'social-services', 'nonprofit', null),
  ('00000000-0000-4000-a000-000000000005', 'Breakthrough T1D', 'breakthrough-t1d', 'health-care', 'nonprofit', 'https://www.breakthrought1d.org'),
  ('00000000-0000-4000-a000-000000000006', 'Communities In Schools of San Antonio', 'communities-in-schools-of-san-antonio', 'education', 'nonprofit', null),
  ('00000000-0000-4000-a000-000000000099', 'Example Organization (test data)', 'example-organization', 'youth', 'nonprofit', null);

insert into public.venues (id, name, slug, address_line1, city, state, postal_code, verified) values
  ('00000000-0000-4000-b000-000000000001', 'Patrick Heath Public Library Amphitheater', 'patrick-heath-public-library-amphitheater', '451 North Main St.', 'Boerne', 'TX', null, true),
  ('00000000-0000-4000-b000-000000000002', 'Witte Museum', 'witte-museum', null, 'San Antonio', 'TX', null, true),
  ('00000000-0000-4000-b000-000000000003', 'Silverhorn Golf Club', 'silverhorn-golf-club', '1100 W. Bitters Rd.', 'San Antonio', 'TX', '78216', true),
  ('00000000-0000-4000-b000-000000000004', 'Hyatt Hill Country Resort & Spa', 'hyatt-hill-country-resort-spa', null, 'San Antonio', 'TX', null, true),
  ('00000000-0000-4000-b000-000000000005', 'Witte Museum – Mays Family Center', 'witte-museum-mays-family-center', null, 'San Antonio', 'TX', null, true);

insert into public.submissions (id, submitter_name, submitter_email, organization_id, source) values
  ('00000000-0000-4000-c000-000000000099', 'Test Person', 'test@example.org', '00000000-0000-4000-a000-000000000099', 'web');

insert into public.events
  (slug, title, organization_id, venue_id, event_type_slug, format, starts_at, ends_at, ticket_url, moderation, published_at, legacy_post_id, submission_id, description)
values
  ('halloween-wooftacular', 'Halloween Wooftacular',
   '00000000-0000-4000-a000-000000000001', null, 'festival', 'in_person',
   '2026-10-17 15:00:00+00', '2026-10-17 19:00:00+00', 'https://www.facebook.com/events/1019773334424956',
   'approved', now(), 118439, null, null),
  ('namiwalks-kendall-county', 'NAMIWalks Kendall County',
   '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-b000-000000000001', 'run-walk', 'in_person',
   '2026-10-31 15:00:00+00', '2026-10-31 17:00:00+00', null,
   'approved', now(), 118450, null, null),
  ('gallery-of-hope-gala-mystical-blooms', 'Gallery of Hope Gala – Mystical Blooms',
   '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-b000-000000000002', 'gala', 'in_person',
   '2026-11-08 00:00:00+00', '2026-11-08 04:00:00+00', 'https://casa-satx.org',
   'approved', now(), 118433, null, null),
  ('care-warriors-charity-4-man-scramble', 'Care Warriors Charity 4 man scramble',
   '00000000-0000-4000-a000-000000000004', '00000000-0000-4000-b000-000000000003', 'golf', 'in_person',
   '2026-12-04 16:00:00+00', '2026-12-04 23:00:00+00', null,
   'approved', now(), 118458, null, null),
  ('promise-ball', 'Promise Ball',
   '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000004', 'gala', 'in_person',
   '2027-05-01 23:00:00+00', '2027-05-02 03:00:00+00', 'https://www.breakthrought1d.org/southcentraltx/events/breakthrough-t1d-south-central-texas-promise-ball-2027',
   'approved', now(), 118434, null, null),
  ('keeping-kids-in-school-luncheon', 'Keeping Kids In School Luncheon',
   '00000000-0000-4000-a000-000000000006', '00000000-0000-4000-b000-000000000005', 'luncheon', 'in_person',
   '2027-05-07 16:00:00+00', '2027-05-07 18:00:00+00', null,
   'approved', now(), 118447, null, null),
  ('sample-pending-event', 'Sample pending event (test data)',
   '00000000-0000-4000-a000-000000000099', '00000000-0000-4000-b000-000000000002', 'gala', 'in_person',
   '2026-11-08 00:30:00+00', '2026-11-08 03:00:00+00', 'https://example.org',
   'pending', null, null, '00000000-0000-4000-c000-000000000099',
   'Made up for local testing. It lands on the same night as the Gallery of Hope Gala on purpose, so the admin queue shows a clash.');

insert into public.admins (email, name) values ('ryan@pearanalytics.com', 'Ryan Kelly');

insert into public.holidays (date, name) values ('2026-11-03', 'Election Day'), ('2026-11-11', 'Veterans Day'), ('2026-11-26', 'Thanksgiving');
