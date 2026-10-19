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
  /*
   * The partner strip. Logo files came off the WordPress about page and sit
   * in public/partners/. The sizes are each file's own, so the strip can work
   * out a shape without reading the image: the three wordmarks are wide, the
   * Kronkosky mark is square and the CE Group lockup is taller than it is
   * wide, and each is sized to look right rather than to one fixed height.
   */
  partners: [
    { name: 'The Nonprofit Council', logo: '/partners/nonprofit-council.png', width: 200, height: 64, url: 'https://tncouncil.org' },
    { name: 'Kronkosky Foundation', logo: '/partners/kronkosky.png', width: 150, height: 150, url: 'https://kronkosky.org' },
    {
      name: 'San Antonio Business Journal',
      logo: '/partners/sabj.webp',
      width: 495,
      height: 151,
      // Not san-antonio: the Business Journal's own event links in the
      // WordPress export spell the city without a hyphen.
      url: 'https://www.bizjournals.com/sanantonio'
    },
    // cegroupinc.net, not the .com, which belongs to a civil engineering firm.
    { name: 'The CE Group', logo: '/partners/ce-group.png', width: 150, height: 195, url: 'https://www.cegroupinc.net' },
    { name: 'Pear Analytics', logo: '/partners/pear-analytics.png', width: 1682, height: 435, url: 'https://pearanalytics.com' }
  ],
  // The footer shows only the accounts listed here. The old site linked
  // Twitter, Facebook and YouTube icons to nowhere; add real addresses
  // before adding entries.
  social: [] as Array<{ label: string; url: string }>
} as const;
