import Link from 'next/link';
import a from '../admin.module.css';

/*
 * Two kinds of page under one address: the work, and the whole list.
 *
 * The count is on the work tab and nowhere else, in the same amber the bar
 * at the top uses, because a number next to "All organizations" would read
 * as a hundred things to do rather than a hundred things that exist.
 */
export default function Tabs({
  current,
  tabs
}: {
  current: string;
  tabs: Array<{ key: string; label: string; href: string; count?: number; quiet?: boolean }>;
}) {
  return (
    <nav className={a.tabs} aria-label="Views">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`${a.tab} ${t.key === current ? a.tabOn : ''}`} aria-current={t.key === current ? 'page' : undefined}>
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className={t.quiet ? a.tabCountQuiet : a.count}>{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
