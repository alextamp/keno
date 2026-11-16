import { computeKfgOrganiserStats } from '../organiserStats';
import { KfgMission } from '../domain/entities/kfg.entity';

const m = (id: string, over: Partial<KfgMission>): KfgMission => ({
  id, creatorId: 'me', creatorType: 'organization', creatorName: 'Org', title: id, description: '', kind: 'partnerQr',
  cause: 'food', startsAt: new Date('2026-10-01T10:00:00'), endsAt: new Date('2026-10-01T12:00:00'), minDurationMin: 0,
  areaLabel: 'Αθήνα', capacity: 10, photoWall: true, ridesEnabled: false, points: 250, status: 'published',
  participantCount: 0, participantIds: [], presentIds: [], endedEarly: false, isPrivate: false, joinRequests: {},
  waitlistIds: [], coHostIds: [], invites: {}, isFlagship: false, feedbackGoodCount: 0, feedbackBadCount: 0, verifiedCount: 0, finalized: true, ...over,
});

describe('computeKfgOrganiserStats', () => {
  it('counts finished missions only, attendance, regulars and feedback', () => {
    const stats = computeKfgOrganiserStats([
      m('a', { participantIds: ['u1', 'u2', 'u3', 'u4'], presentIds: ['u1', 'u2', 'u3'], feedbackGoodCount: 3 }),
      m('b', { startsAt: new Date('2026-10-08T10:00:00'), endsAt: new Date('2026-10-08T12:00:00'),
        participantIds: ['u1', 'u5'], presentIds: ['u1'], feedbackBadCount: 1 }),
      m('future', { startsAt: new Date('2026-12-01T10:00:00'), endsAt: new Date('2026-12-01T12:00:00'), participantIds: ['u9'] }),
      m('pending', { status: 'pending', participantIds: ['u8'] }),
    ], new Date('2026-11-16T12:00:00').getTime());
    expect(stats.finished).toBe(2);
    expect(stats.attendanceRate).toBeCloseTo(4 / 6);
    expect(stats.noShowRate).toBeCloseTo(2 / 6);
    expect(stats.uniqueVolunteers).toBe(3);
    expect(stats.returningVolunteers).toBe(1);
    expect(stats.positiveFeedback).toBeCloseTo(0.75);
    expect(stats.recent.map((r) => r.missionId)).toEqual(['b', 'a']);
  });
});
