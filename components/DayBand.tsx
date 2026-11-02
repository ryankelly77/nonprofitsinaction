import { longDateFromString } from '@/lib/time';
import styles from './site.module.css';

/*
 * A band across the whole grid naming the day and how much is on it, with
 * that day's cards following underneath. The cards themselves are untouched.
 */
export default function DayBand({ date, count }: { date: string; count: number }) {
  return (
    <div className={styles.dayBand}>
      <span className={styles.dayBandDate}>{longDateFromString(date)}</span>
      <span className={count > 1 ? styles.dayBandCountBusy : styles.dayBandCount}>
        {count} event{count > 1 ? 's' : ''}
      </span>
    </div>
  );
}
