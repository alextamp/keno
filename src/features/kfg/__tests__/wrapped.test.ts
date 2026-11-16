import { computeKfgWrapped } from '../wrapped';
import { KfgMission, KfgParticipation } from '../domain/entities/kfg.entity';

const mission = (id: string, over: Partial<KfgMission> = {}): KfgMission => ({
  id, creatorId: 'org1', creatorType: 'organization', creatorName: 'Org', title: id, description: '', kind: 'partnerQr',
  cause: 'food', startsAt: new Date('2026-10-10T10:00:00'), endsAt: new Date('2026-10-10T13:00:00'), minDurationMin: 0,
  areaLabel: 'Αθήνα', capacity: 10, photoWall: true, ridesEnabled: false, points: 250, status: 'published', participantCount: 1,
  participantIds: [], presentIds: [], endedEarly: false, isPrivate: false, joinRequests: {}, waitlistIds: [], coHostIds: [], verifiedCount: 1, finalized: true, ...over,
});
const done = (missionId: string, over: Partial<KfgParticipation> = {}): KfgParticipation => ({
  id: `${missionId}_u`, uid: 'u', missionId, missionCreatorId: 'org1', kind: 'partnerQr', creatorType: 'organization',
  status: 'completed', photos: {}, award: { points: 250, countsForLeaderboard: true, levelBefore: 1, levelAfter: 2, unlocked: [] },
  checkInAt: new Date('2026-10-10T10:00:00'), checkOutAt: new Date('2026-10-10T12:30:00'), ...over,
});

describe('computeKfgWrapped', () => {
  const now = new Date('2026-11-16T12:00:00');

  it('counts only completed missions in this semester', () => {
    const missions = [
      mission('a'),
      mission('b', { cause: 'animals', creatorId: 'org2', kind: 'group', startsAt: new Date('2026-10-20T10:00:00'), endsAt: new Date('2026-10-20T12:00:00') }),
      mission('c', { cause: 'animals' }),
      mission('old', { endsAt: new Date('2026-03-01T12:00:00') }),
    ];
    const stats = computeKfgWrapped([
      done('a'),
      done('b', { kind: 'group', checkInAt: undefined, checkOutAt: undefined }),
      done('c', { status: 'joined', award: undefined }),
      done('old', { checkOutAt: undefined, checkInAt: undefined }),
    ], missions, now);
    expect(stats.missions).toBe(2);
    expect(stats.hours).toBe(4.5); // 2.5 (QR check-in → out) + 2 (group mission length)
    expect(stats.points).toBe(500);
    expect(stats.organizations).toBe(2);
    expect(stats.causeCounts).toEqual([{ cause: 'food', count: 1 }, { cause: 'animals', count: 1 }]);
    expect(stats.tickets.map((tk) => [tk.mission.id, tk.serial])).toEqual([['a', 1], ['b', 2]]);
  });
});
