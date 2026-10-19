import Image from 'next/image';
import { SITE } from '@/content/site';
import styles from './site.module.css';

/*
 * The partner logos, used by the home strip and the about page. Each one
 * links to the partner. The marks are nothing like each other in shape, so a
 * logo taller than it is wide (the CE Group lockup) or square (the Kronkosky
 * mark) is set taller than a wordmark, or it would read as much smaller.
 */
export default function PartnerLogos() {
  return (
    <>
      {SITE.partners.map((p) => (
        <a key={p.name} href={p.url} className={styles.partnerLink} rel="noopener">
          <Image
            src={p.logo}
            alt={p.name}
            width={p.width}
            height={p.height}
            className={`${styles.partnerLogo} ${p.width / p.height < 1.6 ? styles.partnerLogoUpright : ''}`}
          />
        </a>
      ))}
    </>
  );
}
