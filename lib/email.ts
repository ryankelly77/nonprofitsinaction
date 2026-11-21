import 'server-only';
import { SITE } from '../content/site.ts';
import { emailingSubmitters } from './settings-store.ts';

/*
 * Outgoing email through Mailgun, the same provider pear-portal uses.
 *
 * Email is never what decides whether something was saved. A submission is
 * stored first and emailed second; if Mailgun is down or not configured, the
 * submission stands, the failure is logged, and Slack (when set up) still
 * hears about it.
 *
 * Without MAILGUN_API_KEY, `next dev` prints each message to the server log
 * instead, so every flow can be followed end to end. Anywhere else nothing is
 * sent and the failure is logged.
 */

export interface Email {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
}

/*
 * Anything addressed to the person who submitted a listing goes through here
 * rather than sendEmail, so there is one place that decides whether the
 * calendar is open enough to be writing to them yet. Before launch it is
 * written to the log and no further, and the caller is told it was not sent.
 *
 * Admin mail keeps using sendEmail directly: telling the reviewer that a
 * listing arrived, and inviting a new admin, are both wanted before launch.
 */
export async function sendSubmitterEmail(message: Email): Promise<boolean> {
  if (!(await emailingSubmitters())) {
    console.info(`[email] held back: "Email the people who submit listings" is off in /admin/settings/: "${message.subject}"`);
    return false;
  }
  return sendEmail(message);
}

export async function sendEmail(message: Email): Promise<boolean> {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  /*
   * The display name follows the rebrand; the address does not. Mailgun sends
   * only from nonprofitsinaction.org until the new sending domain is verified,
   * which is a step in docs/LAUNCH.md.
   */
  const from = process.env.EMAIL_FROM ?? `${SITE.name} <calendar@nonprofitsinaction.org>`;
  const to = Array.isArray(message.to) ? message.to : [message.to];
  if (to.length === 0) return true;

  if (!key || !domain) {
    // The body can hold a private edit link, so it is printed under `next dev`
    // only. A deployment without Mailgun logs that it sent nothing, and no more.
    if (process.env.NODE_ENV === 'development') {
      console.info(`[email] (not sent: Mailgun not configured)\nTo: ${to.join(', ')}\nSubject: ${message.subject}\n\n${message.text}\n`);
      return true;
    }
    console.error(`[email] NOT SENT, Mailgun is not configured: "${message.subject}"`);
    return false;
  }

  const base = process.env.MAILGUN_API_BASE ?? 'https://api.mailgun.net';
  const body = new URLSearchParams();
  body.set('from', from);
  for (const t of to) body.append('to', t);
  body.set('subject', message.subject);
  body.set('text', message.text);
  if (message.replyTo) body.set('h:Reply-To', message.replyTo);

  try {
    const res = await fetch(`${base}/v3/${domain}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`api:${key}`).toString('base64')}` },
      body,
      cache: 'no-store'
    });
    if (!res.ok) {
      console.error(`[email] Mailgun refused (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Mailgun unreachable:', err);
    return false;
  }
}
