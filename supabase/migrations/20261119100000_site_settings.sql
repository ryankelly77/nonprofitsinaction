-- ---------------------------------------------------------------------------
-- Settings an admin can change without a deploy
-- ---------------------------------------------------------------------------
--
-- One of these existed as an environment variable: EMAIL_SUBMITTERS, which
-- decides whether the people who submit listings are written to yet. It is
-- off while the imported listings are worked through, and turning it on is a
-- step in docs/LAUNCH.md. As an environment variable that step meant editing
-- Vercel and waiting for a redeploy, which is not where the person who
-- decides it is standing.
--
-- Key and value as text rather than a column per setting, because each new
-- setting would otherwise be a migration. The server reads these through the
-- service role; nothing public reads them, so row level security is on with
-- no policy at all.

create table public.site_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

alter table public.site_settings enable row level security;

/*
 * Off, which is what the environment variable was in production when this
 * ran. A setting that arrived switched on would start writing to a few
 * hundred people who submitted to the old site, which is the one outcome
 * this flag exists to prevent.
 */
insert into public.site_settings (key, value) values ('email_submitters', 'off');
