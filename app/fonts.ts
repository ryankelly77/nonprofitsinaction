import localFont from 'next/font/local';

/*
 * The three typefaces, served from this repository. The files are the Latin
 * subsets published by Fontsource (SIL Open Font License), committed so a
 * build never depends on Google being reachable and a visitor's browser never
 * opens a connection to it. Stylesheets use the variables, never the names.
 */

/** Headlines. Variable weight and optical size. */
export const display = localFont({
  src: './fonts/bricolage-grotesque-latin-opsz-normal.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-display',
  fallback: ['Arial', 'sans-serif']
});

/** Body copy. Variable weight. */
export const body = localFont({
  src: './fonts/public-sans-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-body',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
});

/** Small capitals labels: dates, eyebrows. */
export const mono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-600-normal.woff2', weight: '600', style: 'normal' }
  ],
  display: 'swap',
  variable: '--font-mono',
  fallback: ['ui-monospace', 'Menlo', 'monospace']
});
