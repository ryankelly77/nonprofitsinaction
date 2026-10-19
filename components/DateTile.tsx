import { dateTile } from '@/lib/time';
import styles from './site.module.css';

export default function DateTile({ at, small = false }: { at: string; small?: boolean }) {
  const t = dateTile(at);
  return (
    <div className={`${styles.tile} ${small ? styles.tileSmall : ''}`} aria-hidden="true">
      <span className={styles.tileWeekday}>{t.weekday}</span>
      <span className={styles.tileDay}>{t.day}</span>
      <span className={styles.tileMonth}>{t.month}</span>
    </div>
  );
}
