import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';

/*
 * Everything public is crawlable (the old site sent noindex on its main
 * pages). Admin and private edit links are kept out by a noindex header in
 * next.config.ts as well as here.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/manage/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
