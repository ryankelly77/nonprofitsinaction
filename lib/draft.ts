import type { EventDraft } from '@/components/EventFields';
import { localParts } from './time.ts';

/** A stored event as the edit form's starting values, in San Antonio time. */
export function eventToDraft(e: {
  id: string;
  title: string;
  event_type_slug: string | null;
  format: 'in_person' | 'virtual' | 'hybrid';
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  online_url: string | null;
  ticket_url: string | null;
  description: string | null;
  image_path: string | null;
  venue: { id: string; name: string } | null;
}, imageUrl: string | null): EventDraft {
  const s = localParts(e.starts_at);
  const endInstant = e.all_day ? new Date(new Date(e.ends_at).getTime() - 1) : new Date(e.ends_at);
  const en = localParts(endInstant);
  const multiDay = e.all_day ? en.date !== s.date : en.date !== s.date;
  return {
    key: e.id,
    title: e.title,
    type: e.event_type_slug ?? '',
    format: e.format,
    date: s.date,
    endDate: multiDay ? en.date : '',
    multiDay,
    allDay: e.all_day,
    start: e.all_day ? '' : s.time,
    end: e.all_day ? '' : localParts(e.ends_at).time,
    venueId: e.venue?.id ?? '',
    venueName: e.venue?.name ?? '',
    venueIsNew: false,
    venueAddress: '',
    venueCity: 'San Antonio',
    venuePostal: '',
    onlineUrl: e.online_url ?? '',
    ticketUrl: e.ticket_url ?? '',
    description: e.description ?? '',
    imagePath: e.image_path ?? '',
    imagePreview: imageUrl ?? ''
  };
}

