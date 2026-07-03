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

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleEventReminder(event: EventEntity): Promise<void> {
  try {
    const granted = await requestNotificationPermissions();
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
    const granted = await requestNotificationPermissions();
    if (!granted) return null;
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
