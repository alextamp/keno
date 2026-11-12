import { missionsThisWeek, openMissionsFor } from '../missions';
import { KfgMission, KfgParticipation } from '../domain/entities/kfg.entity';

const now = Date.parse('2026-11-12T10:00:00Z');
const h = (n: number) => new Date(now + n * 3_600_000);
const mission = (id: string, startH: number, extra: Partial<KfgMission> = {}): KfgMission => ({
  id, creatorId: 'org', creatorType: 'organization', creatorName: 'Org', title: id, description: '', kind: 'partnerQr',
  cause: 'food', startsAt: h(startH), endsAt: h(startH + 3), minDurationMin: 0, areaLabel: 'Αθήνα', capacity: 10,
  points: 250, status: 'published', participantCount: 0, participantIds: [], verifiedCount: 0, finalized: false, ...extra,
});
const joined = (missionId: string): KfgParticipation => ({
  id: `${missionId}_u`, uid: 'u', missionId, missionCreatorId: 'org', kind: 'partnerQr', creatorType: 'organization',
  status: 'joined', photos: {},
});

describe('openMissionsFor', () => {
  it('counts only missions the user can still join this week', () => {
    const list = [
      mission('ok', 24), mission('later', 24 * 9), mission('full', 24, { participantCount: 10 }),
      mission('mine', 24, { creatorId: 'u' }), mission('joined', 24), mission('over', -10),
    ];
    expect(openMissionsFor(list, [joined('joined')], 'u', now).map((m) => m.id)).toEqual(['ok']);
  });
});

describe('missionsThisWeek', () => {
  it('shows this week plus joined ones later, sorted', () => {
    const list = [mission('b', 48), mission('a', 2), mission('farJoined', 24 * 10), mission('far', 24 * 10)];
    expect(missionsThisWeek(list, [joined('farJoined')], now).map((m) => m.id)).toEqual(['a', 'b', 'farJoined']);
  });
});
