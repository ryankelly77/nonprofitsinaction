import a from '../../../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * The organization's own website, live, beside the form.
 *
 * It is here to answer the question an admin asks while reading a name they
 * have not read before: is this who I think it is, and is the name written
 * the way they write it. Their own masthead answers both in a second, and the
 * alternative was opening a tab and coming back.
 *
 * A picture rather than a frame to use. The page is loaded at a desktop width
 * and scaled down, so it reads as the site rather than as the same site
 * squeezed into a phone, and pointer events are off: clicking through a
 * shrunken copy of somebody's homepage is not something anybody means to do,
 * and the link underneath is the way to actually go there.
 *
 * Sandboxed, with scripts allowed because a good half of these sites render
 * nothing without them. allow-same-origin here means "be your own origin",
 * which is what lets a third-party page use its own cookies and storage; it
 * does not give it ours, since it is cross-origin either way. No referrer is
 * sent, so an organization's analytics never shows our admin as a source.
 *
 * Whether a site can be framed at all is not ours to decide: plenty send
 * X-Frame-Options or frame-ancestors and will show the browser's own refusal
 * instead. That cannot be detected from here, because the refusal page loads
 * like any other and a cross-origin document cannot be read, so there is no
 * clever fallback. The link and the note under it are always there, which is
 * the honest version of one.
 */
export default function WebsitePreview({ url }: { url: string }) {
  let host = url;
  try {
    host = new URL(url).host.replace(/^www\./, '');
  } catch {
    // Already checked by safeUrl before it gets here; show it as given.
  }

  return (
    <div className={a.preview}>
      <p className={a.previewLabel}>Their website</p>
      <div className={a.previewFrame}>
        <iframe
          src={url}
          title={`${host}, as it looks now`}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          loading="lazy"
          tabIndex={-1}
        />
      </div>
      <p className={styles.small} style={{ margin: '8px 0 0' }}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {host}
        </a>
        <br />
        Nothing showing? Some sites refuse to be previewed. Open it in a tab instead.
      </p>
    </div>
  );
}
