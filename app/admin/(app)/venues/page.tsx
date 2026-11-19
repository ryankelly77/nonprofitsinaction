import { requireAdmin } from '@/lib/admin-auth';
import { adminVenues, eventsByRecord, venueDuplicates, venuesWithoutAddress, type EventPeek as EventPeekRow } from '@/lib/admin-data';
import AddressFixer from './AddressFixer';
import VenueAddress from './VenueAddress';
import DuplicateList from '../DuplicateList';
import EventPeek from '../EventPeek';
import Retired from '../Retired';
import RecordAnswer from '../RecordAnswer';
import Tabs from '../Tabs';
import { hasPlaces } from '@/lib/places';
import { addRecord, saveVenueDetails } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Venues' };

/*
 * The same two tabs as the organizations page, for the same reason: the
 * lookalikes and the names nobody has read are work with an end to it, and
 * the whole list is a reference. See that page for the longer version.
 */
export default async function VenuesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show } = await searchParams;
  const [all, retired, duplicates, noAddress] = await Promise.all([
    adminVenues(),
    adminVenues({ retired: true }),
    venueDuplicates(),
    venuesWithoutAddress()
  ]);
  if (show === 'retired') return <Retired kind="venue" rows={retired} back="/admin/venues/" />;

  const unchecked = all.filter((v) => !v.verified);
  /*
   * A venue with no address and an event still to come is the one somebody
   * has to be able to find this year, so it is what the count offers. The
   * rest are listed under it and can be worked through at leisure.
   */
  const addressUrgent = noAddress.filter((v) => v.upcoming);
  const needsReview = unchecked.length + duplicates.length + addressUrgent.length;
  const canLookUp = hasPlaces();
  const tab = show === 'all' ? 'all' : 'review';
  const targets = all.map((v) => ({ id: v.id, name: v.name }));
  /* What is filed under the records on the review tab, in one query. See the
     organizations page for the longer version. */
  const peek = await eventsByRecord(
    'venue',
    tab === 'review' ? [...unchecked.map((v) => v.id), ...duplicates.flatMap((p) => [p.a.id, p.b.id])] : all.map((v) => v.id)
  );

  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>Venues</h1>
        {retired.length > 0 && (
          <p className={styles.small} style={{ margin: 0 }}>
            <a href="/admin/venues/?show=retired">Retired ({retired.length})</a>
          </p>
        )}
      </div>

      <Tabs
        current={tab}
        tabs={[
          { key: 'review', label: 'Review', href: '/admin/venues/', count: needsReview },
          { key: 'all', label: 'All venues', href: '/admin/venues/?show=all', count: all.length, quiet: true }
        ]}
      />

      {tab === 'review' ? (
        <>
          <h2 className={styles.h3} style={{ marginTop: 32 }}>Possible duplicates</h2>
          <p className={styles.small} style={{ marginTop: 4 }}>
            Names close enough that they may be one place. Nothing is merged until you say so, and &ldquo;not the same&rdquo; keeps a pair off this list for
            good.
          </p>
          <DuplicateList kind="venue" pairs={duplicates} events={peek} />

          {/*
            * The instructions only appear when there is something to follow
            * them on. It used to say "nobody has read these names yet" above
            * "every venue has been read", which is two answers to the same
            * question and neither of them the one being asked.
            */}
          <h2 className={styles.h3} style={{ marginTop: 40 }}>Not checked yet</h2>
          {unchecked.length === 0 ? (
            <p className={styles.empty} style={{ marginTop: 8 }}>
              Every venue has been checked. A venue is checked once somebody has read its name and agreed it is a real place, which is what lets the submit
              form suggest it to the next person.
            </p>
          ) : (
            <>
              <p className={styles.small} style={{ marginTop: 4 }}>
                A venue nobody has read is never suggested on the submit form, so a misspelling cannot spread. Fix the name and address, then mark it
                checked.
              </p>
              <VenueTable rows={unchecked} targets={targets} events={peek} canLookUp={canLookUp} />
            </>
          )}

          <h2 className={styles.h3} style={{ marginTop: 40 }}>
            No street address{addressUrgent.length > 0 && <span className={a.count}>{addressUrgent.length}</span>}
          </h2>
          <p className={styles.small} style={{ marginTop: 4 }}>
            Guests cannot find these and neither can a search engine: an address is the question an assistant is most often asked about an event. The ones
            with a date still to come are first.{' '}
            {canLookUp
              ? 'Ask Google fills the boxes with what it finds; read it before you save, because a wrong address sends people to the wrong building.'
              : 'Set GOOGLE_PLACES_API_KEY in Vercel to look these up from here instead of in another tab.'}
          </p>
          {noAddress.length === 0 ? (
            <p className={styles.empty}>Every venue has an address.</p>
          ) : (
            <div className={a.tableWrap}>
              <table className={a.table}>
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Street address</th>
                    <th>City</th>
                    <th>ZIP</th>
                    <th>What to do</th>
                  </tr>
                </thead>
                <tbody>
                  {noAddress.map((v) => (
                    <AddressFixer key={v.id} id={v.id} name={v.name} city={v.city} events={v.events} upcoming={v.upcoming} canLookUp={canLookUp} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <p className={styles.body} style={{ marginTop: 24 }}>
            Every venue on the calendar. Merging moves every event to the venue you pick and keeps the old name as a pointer.
          </p>
          <VenueTable rows={all} targets={targets} events={peek} canLookUp={canLookUp} />

          <h2 className={styles.h3} style={{ marginTop: 40 }}>Add one</h2>
          <form action={addRecord} className={a.inline} style={{ marginTop: 8 }}>
            <input type="hidden" name="kind" value="venue" />
            <input name="name" placeholder="Venue name" aria-label="Venue name" className={a.cellInput} style={{ minWidth: 240 }} required />
            <input name="address" placeholder="Street address" aria-label="Street address" className={a.cellInput} style={{ minWidth: 220 }} />
            <input name="city" placeholder="City" aria-label="City" defaultValue="San Antonio" className={a.cellInput} style={{ width: 150 }} />
            <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
              Add
            </button>
          </form>
          <p className={styles.small} style={{ marginTop: 6 }}>
            Added here counts as checked, since you are the one adding it. Retiring takes a venue off the form and the lists while leaving its events alone;
            one that nothing at all points at is removed outright.
          </p>
        </>
      )}
    </>
  );
}

function VenueTable({
  rows,
  targets,
  events,
  canLookUp
}: {
  rows: Array<{ id: string; name: string; verified: boolean; address_line1: string | null; city: string | null; postal_code: string | null; events: number }>;
  targets: Array<{ id: string; name: string }>;
  events: Map<string, EventPeekRow[]>;
  canLookUp: boolean;
}) {
  return (
    <div className={a.tableWrap}>
      <table className={a.table}>
        <thead>
          <tr>
            <th>Venue</th>
            <th>Street address</th>
            <th>City</th>
            <th>ZIP</th>
            <th>Events</th>
            <th>Action</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td>
                {/*
                  * One form per row, so the row has one button. It has to be
                  * an empty element with the fields naming it, because a form
                  * cannot wrap a <tr>; that is what the form attribute is for.
                  */}
                <form id={`venue-${v.id}`} action={saveVenueDetails} />
                <input type="hidden" name="id" value={v.id} form={`venue-${v.id}`} />
                <input type="hidden" name="kind" value="venue" form={`venue-${v.id}`} />
                <input name="name" defaultValue={v.name} aria-label="Name" className={a.cellInput} form={`venue-${v.id}`} />
                <div className={styles.small} style={{ marginTop: 4 }}>{v.verified ? 'Checked' : 'Not read yet'}</div>
              </td>
              {/* The three address columns, with Google offered while the
                  street line is empty. See VenueAddress. */}
              <VenueAddress
                name={v.name}
                form={`venue-${v.id}`}
                address={v.address_line1}
                city={v.city}
                postal={v.postal_code}
                canLookUp={canLookUp}
              />
              <td style={{ whiteSpace: 'nowrap' }}>
                <EventPeek events={events.get(v.id) ?? []} count={v.events} />
              </td>
              <td>
                <RecordAnswer
                  kind="venue"
                  id={v.id}
                  form={`venue-${v.id}`}
                  verified={v.verified}
                  mergeInto={targets.filter((t) => t.id !== v.id)}
                  className={a.cellInput}
                />
              </td>
              <td>
                <button type="submit" form={`venue-${v.id}`} className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
