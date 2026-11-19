import 'server-only';
import { meansOn, onOff, type SettingKey } from './settings.ts';
import { serviceClient } from './supabase/service.ts';

/*
 * Reading and writing the settings an admin changes in the admin. What the
 * values mean is in lib/settings.ts, which is where the rules are tested.
 *
 * Read fresh every time, never cached. There is one of these so far and it
 * decides whether a few hundred people hear from us; a cached answer would
 * mean the switch looks thrown and nothing changes, or worse, reads as off
 * for a while after it was turned on. One small query on the rare occasion a
 * submitter is written to is not worth a cache.
 */

async function readSetting(key: SettingKey): Promise<string | null> {
  const { data, error } = await serviceClient().from('site_settings').select('value').eq('key', key).maybeSingle();
  if (error) {
    /*
     * A setting that cannot be read is not the same as a setting that is off,
     * but for this one they have to behave the same way: the safe answer is
     * the one that sends nothing. meansOn(null) is false.
     */
    console.error(`[settings] could not read ${key}: ${error.message}`);
    return null;
  }
  return data?.value ?? null;
}

async function writeSetting(key: SettingKey, value: string): Promise<void> {
  const { error } = await serviceClient().from('site_settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw new Error(`could not save ${key}: ${error.message}`);
}

/**
 * Whether the people who submit listings are written to yet.
 *
 * Off until an admin turns it on under "Lists", which is a step in
 * docs/LAUNCH.md. Off is the state that cannot embarrass anybody, so it is
 * what an unset or unreadable value means. Admins are emailed throughout, and
 * so are sign-in codes, which do not come through here at all.
 */
export async function emailingSubmitters(): Promise<boolean> {
  return meansOn(await readSetting('email_submitters'));
}

export async function setEmailingSubmitters(on: boolean): Promise<void> {
  await writeSetting('email_submitters', onOff(on));
}
