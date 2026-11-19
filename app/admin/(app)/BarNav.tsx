'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import a from '../admin.module.css';

/*
 * The first tier of the admin bar: where the calendar is run from, in the
 * order somebody runs it.
 *
 * It marks which page you are on. The stylesheet has always had a rule for
 * that, on [aria-current='page'], but nothing ever set the attribute, so the
 * bar looked the same everywhere. Knowing the path means being a client
 * component; the counts are read on the server and handed down.
 *
 * A section rather than an exact address: /admin/events/<id>/ is still
 * Events, and /admin/organizations/<id>/ is still Organizations, which is
 * most of the places you end up. The dashboard is the exception, since every
 * address begins with it.
 */
export default function BarNav({ counts }: { counts: { review: number; venues: number; organizations: number } }) {
  const path = usePathname();
  const here = path.endsWith('/') ? path : `${path}/`;
  const on = (href: string) => (href === '/admin/' ? here === '/admin/' : here.startsWith(href));

  const link = (href: string, label: React.ReactNode) => (
    <Link href={href} className={a.barLink} aria-current={on(href) ? 'page' : undefined}>
      {label}
    </Link>
  );

  return (
    <nav aria-label="Admin" className={a.barNav}>
      <Link href="/admin/" className={`${a.barLink} ${a.barHome}`} aria-label="Dashboard" title="Dashboard" aria-current={on('/admin/') ? 'page' : undefined}>
        <Icon name="home" size={20} />
      </Link>
      {link(
        '/admin/review/',
        <>
          Review{counts.review > 0 && <span className={a.count}>{counts.review}</span>}
        </>
      )}
      {link('/admin/events/', 'Events')}
      {link(
        '/admin/venues/',
        <>
          Venues{counts.venues > 0 && <span className={a.count}>{counts.venues}</span>}
        </>
      )}
      {link(
        '/admin/organizations/',
        <>
          Organizations{counts.organizations > 0 && <span className={a.count}>{counts.organizations}</span>}
        </>
      )}
      {link('/admin/settings/', 'Settings')}
    </nav>
  );
}
