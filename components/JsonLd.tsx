/*
 * One JSON-LD block. The "<" escape stops a string inside the data (an event
 * title) from closing the script element early.
 */
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
