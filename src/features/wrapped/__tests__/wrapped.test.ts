import { computeWrapped } from '../wrapped';
import { UserEntity } from '@/features/auth/domain/entities/user.entity';
import { EventCategory, EventEntity } from '@/features/events/domain/entities/event.entity';
import { getSemesterBounds } from '@/core/utils/weekId';

const NOW = new Date(2026, 9, 27, 12); // 27 Oct 2026 → "2026-fall"

function makeEvent(id: string, overrides: Partial<EventEntity> = {}): EventEntity {
  return {
    id, title: `Event ${id}`, description: '', category: EventCategory.Coffee,
    dateTime: new Date(2026, 8, 10, 18), location: 'Venue, Αθήνα', creatorId: 'someone',
    maxAttendees: 20, attendeeIds: ['me'], reactions: { hype: [], funny: [], interested: [] },
    messages: [], waitlistIds: [], ...overrides,
  };
}

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'me', name: 'Me', universityEmail: 'me@aueb.gr',
    joinedEvents: [], createdEvents: [], following: [], followers: [], ...overrides,
  } as UserEntity;
}

const checkedIn = (date: string) => ({ checkedIn: true, xpStaked: 0, date });

describe('getSemesterBounds', () => {
  it('spans Aug 1 → Jan 31 for the fall semester, including January', () => {
    const { start, end } = getSemesterBounds(new Date(2027, 0, 15));
    expect(start).toEqual(new Date(2026, 7, 1));
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(0);
    expect(end.getDate()).toBe(31);
  });

  it('spans Feb 1 → Jul 31 for the spring semester', () => {
    const { start, end } = getSemesterBounds(new Date(2026, 3, 1));
    expect(start).toEqual(new Date(2026, 1, 1));
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(31);
  });
});

describe('computeWrapped', () => {
  it('counts only real check-ins inside this semester, never RSVPs', () => {
    const events = [makeEvent('a'), makeEvent('b'), makeEvent('c'), makeEvent('old')];
    const user = makeUser({
      attendanceHistory: {
        a: checkedIn('2026-09-10'),
        b: { checkedIn: false, xpStaked: 30, date: '2026-09-12' },
        old: checkedIn('2026-03-01'),
      },
    });
    const w = computeWrapped(user, events, NOW);
    expect(w.eventsAttended).toBe(1);
    expect(w.tickets.map((t) => t.eventId)).toEqual(['a']);
  });

  it('counts new people as co-attendees you did not already follow', () => {
    const events = [
      makeEvent('a', { attendeeIds: ['me', 'friend', 'x', 'y'] }),
      makeEvent('b', { attendeeIds: ['me', 'x', 'z'] }),
    ];
    const user = makeUser({
      following: ['friend'],
      attendanceHistory: { a: checkedIn('2026-09-10'), b: checkedIn('2026-09-20') },
    });
    expect(computeWrapped(user, events, NOW).newPeopleMet).toBe(3);
  });

  it('ranks categories and buckets check-ins into weeks from the semester start', () => {
    const events = [
      makeEvent('a', { category: EventCategory.Sports }),
      makeEvent('b', { category: EventCategory.Sports }),
      makeEvent('c', { category: EventCategory.Study }),
    ];
    const user = makeUser({
      attendanceHistory: { a: checkedIn('2026-08-03'), b: checkedIn('2026-08-04'), c: checkedIn('2026-08-20') },
    });
    const w = computeWrapped(user, events, NOW);
    expect(w.topCategory).toBe(EventCategory.Sports);
    expect(w.categoryCounts[0]).toEqual({ category: EventCategory.Sports, count: 2 });
    expect(w.weeks[0]).toBe(2);
    expect(w.weeks.reduce((s, n) => s + n, 0)).toBe(3);
  });

  it('groups nearby events into one area and measures the longest route', () => {
    const events = [
      makeEvent('a', { latitude: 37.9681, longitude: 23.7281, location: 'Κουκάκι, Αθήνα' }),
      makeEvent('b', { latitude: 37.9684, longitude: 23.7283, location: 'Κουκάκι 2' }),
      makeEvent('c', { latitude: 37.9300, longitude: 23.6900, location: 'Φάληρο' }),
    ];
    const user = makeUser({
      attendanceHistory: { a: checkedIn('2026-09-01'), b: checkedIn('2026-09-02'), c: checkedIn('2026-09-03') },
    });
    const w = computeWrapped(user, events, NOW);
    expect(w.areas).toHaveLength(2);
    expect(w.areas[0]).toMatchObject({ name: 'Κουκάκι', count: 2 });
    expect(w.longestRouteKm).toBeGreaterThan(3);
  });

  it('picks the weekday regular persona when one day dominates', () => {
    const thursday = (day: number) => new Date(2026, 8, day, 19); // 3, 10, 17 Sep 2026 are Thursdays
    const events = [3, 10, 17].map((d, i) => makeEvent(`t${i}`, {
      dateTime: thursday(d),
      category: [EventCategory.Coffee, EventCategory.Sports, EventCategory.Study][i],
    }));
    const user = makeUser({
      attendanceHistory: { t0: checkedIn('2026-09-03'), t1: checkedIn('2026-09-10'), t2: checkedIn('2026-09-17') },
    });
    expect(computeWrapped(user, events, NOW).persona).toEqual({ id: 'regularDay', weekday: 4 });
  });

  it('prefers the organizer persona once someone has created 3+ events this semester', () => {
    const events = ['a', 'b', 'c'].map((id) => makeEvent(id));
    const user = makeUser({
      createdEvents: ['a', 'b', 'c'],
      attendanceHistory: { a: checkedIn('2026-09-10'), b: checkedIn('2026-09-11'), c: checkedIn('2026-09-12') },
    });
    expect(computeWrapped(user, events, NOW).persona.id).toBe('organizer');
  });
});
