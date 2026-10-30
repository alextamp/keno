import { UserEntity } from '@/features/auth/domain/entities/user.entity';
import { EventCategory, EventEntity } from '@/features/events/domain/entities/event.entity';
import { haversineKm } from '@/core/utils/geo';
import { getSemesterBounds, getSemesterId } from '@/core/utils/weekId';

// Below this many real check-ins in the semester, Wrapped shows an
// encouraging empty state instead of a thin, slightly sad recap.
export const WRAPPED_MIN_CHECKINS = 3;

export type WrappedPersonaId =
  | 'organizer' | 'explorer' | 'regularDay' | 'social'
  | 'categoryFan' | 'earlyBird' | 'nightOwl' | 'regular';

export type WrappedTraitId = 'reliable' | 'withFriends' | 'organizes' | 'meetsPeople' | 'topCategory';

export interface WrappedTicket {
  eventId: string;
  title: string;
  category: EventCategory;
  location: string;
  dateTime: Date;
  /** Position among this semester's check-ins, 1-based. */
  serial: number;
  /** Co-attendees here you didn't already follow (not deduped across events). */
  newPeopleHere: number;
}

export interface WrappedArea {
  name: string;
  count: number;
  lat: number;
  lon: number;
  /** Order of first visit, for drawing the route chronologically. */
  firstSeen: number;
}

export interface WrappedStats {
  semesterId: string;
  eventsAttended: number;
  eventsCreated: number;
  newPeopleMet: number;
  longestStreak: number;
  freezeTokens: number;
  /** Sorted by count, highest first. */
  categoryCounts: { category: EventCategory; count: number }[];
  topCategory: EventCategory | null;
  /** Events checked into per week, from semester start up to now (or semester end). */
  weeks: number[];
  tickets: WrappedTicket[];
  /** Approximate areas (~1 km cells), never exact addresses. Sorted by count. */
  areas: WrappedArea[];
  /** Furthest distance between any two visited areas. */
  longestRouteKm: number;
  persona: { id: WrappedPersonaId; weekday?: number; category?: EventCategory };
  traits: WrappedTraitId[];
}

const WEEK_MS = 7 * 86400000;

// Venue names tend to come first in a free-text location, so the first
// comma segment is the most recognisable short label for an area.
export function areaLabel(location: string): string {
  return location.split(',')[0].trim() || location.trim();
}

function pickPersona(
  attended: EventEntity[],
  eventsCreated: number,
  newPeopleMet: number,
  categoryCounts: { category: EventCategory; count: number }[],
): WrappedStats['persona'] {
  const n = attended.length;
  if (eventsCreated >= 3) return { id: 'organizer' };
  if (categoryCounts.length >= 4) return { id: 'explorer' };

  const byWeekday = new Array(7).fill(0);
  attended.forEach((e) => { byWeekday[e.dateTime.getDay()] += 1; });
  const topDay = byWeekday.indexOf(Math.max(...byWeekday));
  if (byWeekday[topDay] >= 3 && byWeekday[topDay] / n >= 0.4) return { id: 'regularDay', weekday: topDay };

  if (newPeopleMet >= 15) return { id: 'social' };

  const top = categoryCounts[0];
  if (top && top.count / n >= 0.5) return { id: 'categoryFan', category: top.category };

  const hours = attended.map((e) => e.dateTime.getHours());
  if (hours.filter((h) => h < 12).length / n >= 0.5) return { id: 'earlyBird' };
  if (hours.filter((h) => h >= 20 || h < 4).length / n >= 0.5) return { id: 'nightOwl' };

  return { id: 'regular' };
}

export function computeWrapped(user: UserEntity, events: EventEntity[], now: Date = new Date()): WrappedStats {
  const { start, end } = getSemesterBounds(now);
  const history = user.attendanceHistory ?? {};

  // attendanceHistory is the source of truth for a real check-in (not just an
  // RSVP); the event docs only supply category/location/attendees.
  const attended = events
    .filter((e) => {
      const h = history[e.id];
      if (!h?.checkedIn) return false;
      const d = new Date(h.date);
      return d >= start && d <= end;
    })
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  // Only events also present in `events` (the creator is normally an
  // attendee of their own event) can be dated; any others are skipped.
  const created = new Set(user.createdEvents);
  const eventsCreated = events.filter((e) => created.has(e.id) && e.dateTime >= start && e.dateTime <= end).length;

  const following = new Set(user.following ?? []);
  const met = new Set<string>();
  attended.forEach((e) => e.attendeeIds.forEach((uid) => {
    if (uid !== user.id && !following.has(uid)) met.add(uid);
  }));

  const counts = new Map<EventCategory, number>();
  attended.forEach((e) => counts.set(e.category, (counts.get(e.category) ?? 0) + 1));
  const categoryCounts = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const weekCount = Math.max(1, Math.ceil((Math.min(now.getTime(), end.getTime()) - start.getTime()) / WEEK_MS));
  const weeks = new Array(weekCount).fill(0);
  attended.forEach((e) => {
    const d = new Date(history[e.id].date);
    const i = Math.min(weekCount - 1, Math.max(0, Math.floor((d.getTime() - start.getTime()) / WEEK_MS)));
    weeks[i] += 1;
  });

  const cells = new Map<string, WrappedArea>();
  attended.forEach((e) => {
    if (e.latitude == null || e.longitude == null) return;
    const key = `${e.latitude.toFixed(2)},${e.longitude.toFixed(2)}`;
    const cell = cells.get(key);
    if (cell) cell.count += 1;
    else cells.set(key, { name: areaLabel(e.location), count: 1, lat: e.latitude, lon: e.longitude, firstSeen: cells.size });
  });
  const areas = [...cells.values()].sort((a, b) => b.count - a.count);
  let longestRouteKm = 0;
  for (let i = 0; i < areas.length; i++) {
    for (let j = i + 1; j < areas.length; j++) {
      longestRouteKm = Math.max(longestRouteKm, haversineKm(areas[i].lat, areas[i].lon, areas[j].lat, areas[j].lon));
    }
  }

  const traits: WrappedTraitId[] = [];
  if ((user.reliabilityScore ?? 0) >= 90) traits.push('reliable');
  const withFriends = attended.filter((e) => e.attendeeIds.some((uid) => following.has(uid))).length;
  if (attended.length > 0 && withFriends / attended.length >= 0.5) traits.push('withFriends');
  if (eventsCreated >= 1) traits.push('organizes');
  if (met.size >= 10) traits.push('meetsPeople');
  if (categoryCounts.length > 0) traits.push('topCategory');

  return {
    semesterId: getSemesterId(now),
    eventsAttended: attended.length,
    eventsCreated,
    newPeopleMet: met.size,
    longestStreak: user.longestStreak ?? 0,
    freezeTokens: user.streakFreezeTokens ?? 0,
    categoryCounts,
    topCategory: categoryCounts[0]?.category ?? null,
    weeks,
    tickets: attended.map((e, i) => ({
      eventId: e.id, title: e.title, category: e.category, location: e.location, dateTime: e.dateTime, serial: i + 1,
      newPeopleHere: e.attendeeIds.filter((uid) => uid !== user.id && !following.has(uid)).length,
    })),
    areas,
    longestRouteKm: Math.round(longestRouteKm),
    persona: attended.length > 0 ? pickPersona(attended, eventsCreated, met.size, categoryCounts) : { id: 'regular' },
    traits: traits.slice(0, 3),
  };
}
