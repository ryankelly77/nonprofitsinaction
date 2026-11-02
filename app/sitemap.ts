import type { MetadataRoute } from 'next';
import { getAllEventSlugs, getOrganizationSlugsWithEvents } from '@/lib/data';
import { SITE_URL } from '@/lib/env';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, orgs] = await Promise.all([getAllEventSlugs(), getOrganizationSlugsWithEvents()]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/events/`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/calendar/`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/submit/`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/about/`, changeFrequency: 'yearly', priority: 0.4 },
    ...events.map((e) => ({ url: `${SITE_URL}/events/${e.slug}/`, lastModified: e.updated_at })),
    ...orgs.map((slug) => ({ url: `${SITE_URL}/organizations/${slug}/` }))
  ];
}
