// SDK 58: the package root's functions now throw at runtime (new object
// API); the unchanged API lives under /legacy.
import * as Calendar from 'expo-calendar/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { EventEntity } from '@/features/events/domain/entities/event.entity';

const CAL_EVENT_KEY = 'cal_event_';

async function getOrCreateKenoCalendarId(): Promise<string> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === 'keno.' || c.title === 'Keno');
  if (existing) return existing.id;

  const defaultCalendar =
    Platform.OS === 'ios'
      ? await Calendar.getDefaultCalendarAsync()
      : calendars.find((c) => c.isPrimary) ?? calendars[0];

  const id = await Calendar.createCalendarAsync({
    title: 'keno.',
    color: '#B8482A',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: (defaultCalendar as any)?.source?.id,
    source: (defaultCalendar as any)?.source ?? { isLocalAccount: true, name: 'keno.', type: 'local' },
    name: 'kenoCalendar',
    ownerAccount: 'keno',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
  return id;
}

/** Anything with a start/end that can go in the keno. calendar (events, KfG missions). */
export interface CalendarItem { id: string; title: string; location: string; start: Date; end: Date; notes?: string }

export async function addToCalendar(item: CalendarItem): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return false;
    const calId = await getOrCreateKenoCalendarId();
    const calEventId = await Calendar.createEventAsync(calId, {
      title: item.title, location: item.location, startDate: item.start, endDate: item.end, notes: item.notes,
      alarms: [{ relativeOffset: -60 }],
    });
    await AsyncStorage.setItem(`${CAL_EVENT_KEY}${item.id}`, calEventId);
    return true;
  } catch {
    return false;
  }
}

export async function addEventToCalendar(event: EventEntity): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return false;

    const calId = await getOrCreateKenoCalendarId();
    const endTime = new Date(event.dateTime.getTime() + 2 * 3600_000); // +2h default

    const calEventId = await Calendar.createEventAsync(calId, {
      title: event.title,
      location: event.location,
      startDate: event.dateTime,
      endDate: endTime,
      notes: event.description,
      alarms: [{ relativeOffset: -60 }], // 1h before
    });

    await AsyncStorage.setItem(`${CAL_EVENT_KEY}${event.id}`, calEventId);
    return true;
  } catch {
    return false;
  }
}

export async function removeEventFromCalendar(eventId: string): Promise<boolean> {
  try {
    const calEventId = await AsyncStorage.getItem(`${CAL_EVENT_KEY}${eventId}`);
    if (!calEventId) return true; // nothing stored, already not in calendar

    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return false;

    await Calendar.deleteEventAsync(calEventId);
    await AsyncStorage.removeItem(`${CAL_EVENT_KEY}${eventId}`);
    return true;
  } catch {
    return false;
  }
}

export async function isEventInCalendar(eventId: string): Promise<boolean> {
  try {
    const id = await AsyncStorage.getItem(`${CAL_EVENT_KEY}${eventId}`);
    return id !== null;
  } catch {
    return false;
  }
}
