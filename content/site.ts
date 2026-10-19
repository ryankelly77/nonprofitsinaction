/*
 * Words and facts used across the site. Change them here, not in the pages.
 * Every fact below is from the WordPress site as of October 2026.
 */
export const SITE = {
  name: 'Nonprofits in Action',
  tagline: 'San Antonio Community Calendar',
  description:
    "San Antonio's shared calendar of nonprofit events: galas, luncheons, walks, golf tournaments and festivals. Find one to attend, or check a date before you plan your own.",
  contactEmail: 'info@tncouncil.org',
  partners: [
    'The Nonprofit Council',
    'Kronkosky Foundation',
    'San Antonio Business Journal',
    'The CE Group',
    'Pear Analytics'
  ],
  // The footer shows only the accounts listed here. The old site linked
  // Twitter, Facebook and YouTube icons to nowhere; add real addresses
  // before adding entries.
  social: [] as Array<{ label: string; url: string }>
} as const;
