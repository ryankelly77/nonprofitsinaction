import 'server-only';
import { sendEmail } from '@/lib/email';
import { serviceClient } from '@/lib/supabase/service';

/*
 * Telling the people who run the calendar that something needs them. Slack
 * when SLACK_WEBHOOK_URL is set, and email to every admin with notify on.
 */

export async function postToSlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), cache: 'no-store' });
  } catch (err) {
    console.error('[slack] webhook failed:', err);
  }
}

export async function notifyAdmins(subject: string, text: string): Promise<void> {
  const db = serviceClient();
  const { data } = await db.from('admins').select('email').eq('notify', true);
  const to = (data ?? []).map((a: { email: string }) => a.email);
  await Promise.all([sendEmail({ to, subject, text }), postToSlack(`*${subject}*\n${text}`)]);
}
