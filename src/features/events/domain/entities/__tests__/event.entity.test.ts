import {
  EventCategory, EventEntity, getCategoryLabel, isAttending, isEventFull, isEventPast,
  isOnWaitlist, parseCategoryOrDefault, spotsLeft, totalReactions,
} from '../event.entity';

function makeEvent(overrides: Partial<EventEntity> = {}): EventEntity {
  return {
    id: 'ev1',
    title: 'Test event',
    description: '',
    category: EventCategory.Coffee,
    dateTime: new Date('2026-10-10T12:00:00Z'),
    location: 'Athens',
    creatorId: 'u1',
    maxAttendees: 10,
    attendeeIds: ['u1'],
    reactions: { hype: [], funny: [], interested: [] },
    messages: [],
    waitlistIds: [],
    ...overrides,
  };
}

describe('isEventFull / spotsLeft', () => {
  it('is not full with room left', () => {
    const e = makeEvent({ maxAttendees: 5, attendeeIds: ['a', 'b'] });
    expect(isEventFull(e)).toBe(false);
    expect(spotsLeft(e)).toBe(3);
  });

  it('is full at capacity, spotsLeft never goes negative', () => {
    const e = makeEvent({ maxAttendees: 2, attendeeIds: ['a', 'b', 'c'] });
    expect(isEventFull(e)).toBe(true);
    expect(spotsLeft(e)).toBe(0);
  });
});

describe('isAttending / isOnWaitlist', () => {
  it('checks attendeeIds / waitlistIds membership', () => {
    const e = makeEvent({ attendeeIds: ['a'], waitlistIds: ['b'] });
    expect(isAttending(e, 'a')).toBe(true);
    expect(isAttending(e, 'b')).toBe(false);
    expect(isOnWaitlist(e, 'b')).toBe(true);
    expect(isOnWaitlist(e, 'a')).toBe(false);
  });
});

describe('isEventPast', () => {
  const NOW = new Date('2026-10-10T12:00:00Z');
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('is not past within the 24h grace window after dateTime', () => {
    const e = makeEvent({ dateTime: new Date('2026-10-09T18:00:00Z') }); // 18h ago
    expect(isEventPast(e)).toBe(false);
  });

  it('is past once 24h has elapsed since dateTime', () => {
    const e = makeEvent({ dateTime: new Date('2026-10-09T11:00:00Z') }); // 25h ago
    expect(isEventPast(e)).toBe(true);
  });

  it('is past immediately once endedAt is set, regardless of dateTime', () => {
    const e = makeEvent({ dateTime: new Date('2026-10-10T13:00:00Z'), endedAt: new Date('2026-10-10T12:30:00Z') });
    expect(isEventPast(e)).toBe(true);
  });
});

describe('getCategoryLabel / parseCategoryOrDefault', () => {
  it('uses the fixed label for a known category', () => {
    expect(getCategoryLabel(EventCategory.Party)).toBe('Party');
  });

  it('uses customCategory text only for Other, when set', () => {
    expect(getCategoryLabel(EventCategory.Other, 'Πεζοπορία')).toBe('Πεζοπορία');
    expect(getCategoryLabel(EventCategory.Other)).toBe('Other');
    expect(getCategoryLabel(EventCategory.Party, 'ignored')).toBe('Party');
  });

  it('parses a known category string, falls back to Other for anything else', () => {
    expect(parseCategoryOrDefault('party')).toBe(EventCategory.Party);
    expect(parseCategoryOrDefault('not-a-real-category')).toBe(EventCategory.Other);
  });
});

describe('totalReactions', () => {
  it('sums all three reaction buckets', () => {
    const e = makeEvent({ reactions: { hype: ['a', 'b'], funny: ['c'], interested: [] } });
    expect(totalReactions(e)).toBe(3);
  });
});
