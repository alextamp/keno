import { computeOrganiserStats } from '../organiserStats';
import { EventCategory, EventEntity } from '@/features/events/domain/entities/event.entity';

const NOW = new Date(2026, 9, 27, 12);

function ev(id: string, daysAgo: number, attendeeIds: string[], overrides: Partial<EventEntity> = {}): EventEntity {
  return {
    id, title: id, description: '', category: EventCategory.Sports,
    dateTime: new Date(NOW.getTime() - daysAgo * 86400000), location: 'x', creatorId: 'host',
    maxAttendees: 20, attendeeIds, reactions: { hype: [], funny: [], interested: [] },
    messages: [], waitlistIds: [], ...overrides,
  };
}

describe('computeOrganiserStats', () => {
  it('excludes the host from every count and ignores unfinished or others\' events', () => {
    const events = [
      ev('a', 5, ['host', 'u1', 'u2', 'u3', 'u4']),
      ev('upcoming', -2, ['host', 'u1']),
      ev('notMine', 5, ['host', 'u1'], { creatorId: 'other' }),
    ];
    const s = computeOrganiserStats('host', events, { a: ['host', 'u1', 'u2', 'u3'] }, NOW);
    expect(s.finishedEvents).toBe(1);
    expect(s.attendanceRate).toBeCloseTo(0.75);
    expect(s.noShowRate).toBeCloseTo(0.25);
    expect(s.uniqueAttendees).toBe(3);
  });

  it('counts returning attendees as people at 2+ events, as a number only', () => {
    const events = [ev('a', 20, ['host', 'u1', 'u2']), ev('b', 10, ['host', 'u1', 'u3']), ev('c', 3, ['host', 'u1', 'u2'])];
    const s = computeOrganiserStats('host', events, { a: ['u1', 'u2'], b: ['u1', 'u3'], c: ['u1', 'u2'] }, NOW);
    expect(s.returningAttendees).toBe(2);
    expect(s.recent.map((r) => r.eventId)).toEqual(['a', 'b', 'c']);
  });

  it('aggregates feedback without exposing who gave it, and keeps only the last 6 events', () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      ev(`e${i}`, 30 - i, ['host', 'u1'], { feedbackGoodCount: 3, feedbackBadCount: 1 }));
    const s = computeOrganiserStats('host', events, {}, NOW);
    expect(s.positiveFeedback).toBeCloseTo(0.75);
    expect(s.feedbackCount).toBe(32);
    expect(s.recent).toHaveLength(6);
    expect(s.recent[5].eventId).toBe('e7');
  });

  it('reports no feedback as null rather than 0%', () => {
    expect(computeOrganiserStats('host', [ev('a', 5, ['host'])], {}, NOW).positiveFeedback).toBeNull();
  });
});
