import type { NextConfig } from 'next';
import redirectList from './content/redirects.json';

const NOINDEX = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }];

const nextConfig: NextConfig = {
  /*
   * Every WordPress address ended in a slash, and that is the form search
   * engines and other sites' links hold. Keeping it means an old event link
   * lands on the new page directly rather than through a redirect.
   */
  trailingSlash: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
        ]
      },
      // The admin and the private edit links are never indexed, whatever links to them.
      { source: '/admin/:path*', headers: NOINDEX },
      { source: '/manage/:path*', headers: NOINDEX }
    ];
  },

  async redirects() {
    // Old WordPress addresses that should keep working. Edit the list in content/redirects.json.
    return redirectList.map(({ source, destination, permanent }) => ({ source, destination, permanent }));
  }
};

export default nextConfig;
