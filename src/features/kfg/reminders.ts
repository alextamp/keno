import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTranslations } from '@/core/i18n';
import { isNotificationPermissionGranted, reminderContextFor } from '@/core/utils/eventReminders';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { KfgMission } from './domain/entities/kfg.entity';
import { useKfgStore } from './presentation/store/kfg.store';

// Local "starts soon" reminders for missions you signed up for — the same
// mechanism and the same Settings (on/off, lead time) as event reminders
// (core/utils/eventReminders), under their own storage prefix so the event
// sync never cancels them and vice versa.

const PREFIX = 'kfg_reminder_';

async function cancel(missionId: string): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(PREFIX + missionId);
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(PREFIX + missionId);
  } catch {}
}

async function schedule(m: KfgMission, leadMinutes: number): Promise<void> {
  await cancel(m.id);
  const at = new Date(m.startsAt.getTime() - leadMinutes * 60_000);
  if (at <= new Date()) return;
  const t = getTranslations();
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: t.reminderTitleLead(leadMinutes, m.title),
        body: t.reminderBody(m.address ? `${m.areaLabel}, ${m.address}` : m.areaLabel),
        data: { type: 'kfg_reminder', eventId: m.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
    await AsyncStorage.setItem(PREFIX + m.id, id);
  } catch {}
}

export async function syncKfgReminders(missions: KfgMission[], enabled: boolean, leadMinutes: number): Promise<void> {
  const keep = enabled ? missions.filter((m) => m.startsAt > new Date()) : [];
  try {
    const keepIds = new Set(keep.map((m) => m.id));
    const keys = await AsyncStorage.getAllKeys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && !keepIds.has(k.slice(PREFIX.length)))
      .map((k) => cancel(k.slice(PREFIX.length))));
  } catch {}
  if (keep.length === 0 || !(await isNotificationPermissionGranted())) return;
  await Promise.all(keep.map((m) => schedule(m, leadMinutes)));
}

/** Keeps reminders in step with the missions you're signed up for (call where the KfG store is running). */
export function useKfgReminderSync(): void {
  const user = useAuthStore((s) => s.user);
  const { missions, participations, loaded } = useKfgStore();
  const joined = missions.filter((m) => participations.some((p) => p.missionId === m.id && p.status === 'joined'));
  const key = joined.map((m) => `${m.id}:${m.startsAt.getTime()}`).sort().join(',');
  const ctx = user ? reminderContextFor(user) : null;
  useEffect(() => {
    if (!loaded || !ctx) return;
    syncKfgReminders(joined, ctx.enabled, ctx.leadMinutes).catch(() => {});
  }, [loaded, key, ctx?.enabled, ctx?.leadMinutes]);
}
