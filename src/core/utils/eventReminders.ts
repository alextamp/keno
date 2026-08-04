import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { EventEntity } from '@/features/events/domain/entities/event.entity';
import { getTranslations } from '@/core/i18n';

const STORAGE_KEY_PREFIX = 'reminder_';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android 8+ silently drops any notification that isn't posted through a
// channel, and without one explicitly created, expo-notifications' default
// channel has no sound and low importance — pushes arrive but never surface
// as a heads-up alert. Must exist before the OS permission prompt / any
// scheduleNotificationAsync/push delivery, so it's created eagerly here.
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Keno',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await ensureAndroidNotificationChannel();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Checks current permission status WITHOUT prompting the OS dialog. The
 *  actual ask (`requestNotificationPermissions`) is reserved for the
 *  notification-permission screen (mockup A4) so it only ever fires from
 *  that one deliberate moment (first event join) — background paths like
 *  reminder scheduling or push-token registration should silently no-op
 *  for users who haven't granted permission yet, not surface a second,
 *  unexpected system prompt. */
export async function isNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

const NOTIF_PROMPT_SHOWN_KEY_PREFIX = 'notif_permission_prompt_shown_';

/** True the first time this is called for a given user — persists a flag so
 *  the notification-permission screen (mockup A4, "asked only after first
 *  join") never shows again for that account, even if they later leave and
 *  re-join events (which would otherwise cycle joinedEvents back to 0 → 1). */
export async function hasShownNotificationPermissionPrompt(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(`${NOTIF_PROMPT_SHOWN_KEY_PREFIX}${userId}`)) === '1';
  } catch {
    return false;
  }
}

export async function markNotificationPermissionPromptShown(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${NOTIF_PROMPT_SHOWN_KEY_PREFIX}${userId}`, '1');
  } catch {}
}

export async function scheduleEventReminder(event: EventEntity): Promise<void> {
  try {
    const granted = await isNotificationPermissionGranted();
    if (!granted) return;

    const reminderTime = new Date(event.dateTime.getTime() - 60 * 60 * 1000);
    if (reminderTime <= new Date()) return;

    // Cancel any existing reminder for this event first
    await cancelEventReminder(event.id);

    const t = getTranslations();
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: t.reminderTitle(event.title),
        body: t.reminderBody(event.location),
        data: { eventId: event.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
    });

    // Persist the identifier so we can cancel it later
    await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${event.id}`, identifier);
  } catch {
    // Silently ignore — reminders are best-effort
  }
}

export async function cancelEventReminder(eventId: string): Promise<void> {
  try {
    const identifier = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${eventId}`);
    if (identifier) {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      await AsyncStorage.removeItem(`${STORAGE_KEY_PREFIX}${eventId}`);
    }
  } catch {
    // Silently ignore
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    const granted = await isNotificationPermissionGranted();
    if (!granted) return null;
    await ensureAndroidNotificationChannel();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function syncEventReminders(joinedEventIds: string[], allEvents: EventEntity[]): Promise<void> {
  const now = new Date();
  const joinedUpcoming = allEvents.filter(
    (e) => joinedEventIds.includes(e.id) && e.dateTime > now,
  );
  await Promise.all(joinedUpcoming.map((e) => scheduleEventReminder(e)));
}
