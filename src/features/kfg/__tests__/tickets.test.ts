import { buildKfgTickets } from '../tickets';
import { KfgMission, KfgParticipation } from '../domain/entities/kfg.entity';

const mission = (id: string, day: number, over: Partial<KfgMission> = {}): KfgMission => ({
  id, creatorId: 'org', creatorType: 'organization', creatorName: 'Org', title: id, description: '', kind: 'partnerQr',
  cause: 'food', startsAt: new Date(2026, 9, day, 10), endsAt: new Date(2026, 9, day, 12), minDurationMin: 0,
  areaLabel: 'Αθήνα', capacity: 10, photoWall: true, ridesEnabled: false, points: 250, status: 'published',
  participantCount: 1, participantIds: ['me'], presentIds: ['me'], endedEarly: false, isPrivate: false, joinRequests: {},
  waitlistIds: [], coHostIds: [], invites: {}, isFlagship: false, feedbackGoodCount: 0, feedbackBadCount: 0, verifiedCount: 1, finalized: true, ...over,
});
const done = (missionId: string, over: Partial<KfgParticipation> = {}): KfgParticipation => ({
  id: `${missionId}_me`, uid: 'me', missionId, missionCreatorId: 'org', kind: 'partnerQr', creatorType: 'organization',
  status: 'completed', photos: {}, ...over,
});

describe('buildKfgTickets labels', () => {
  it('marks welcome, first solo, squad and plus-one like event tickets', () => {
    const missions = [
      mission('first', 1),
      mission('solo', 2),
      mission('squad', 3, { presentIds: ['me', 'a', 'b', 'c'] }),
      mission('plus', 4, { invites: { me: 'a' } }),
      mission('plain', 5),
    ];
    const tickets = buildKfgTickets(
      [done('first'), done('solo', { arrivedSolo: true }), done('squad'), done('plus'), done('plain')],
      missions,
      { uid: 'me', following: ['a', 'b', 'c'], followers: ['a', 'b', 'c'] },
    );
    const byId = Object.fromEntries(tickets.map((tk) => [tk.mission.id, tk.label]));
    expect(byId).toEqual({ first: 'welcome', solo: 'firstSolo', squad: 'squad', plus: 'plusOne', plain: undefined });
    expect(tickets.map((tk) => tk.serial)).toEqual([5, 4, 3, 2, 1]);
  });
});
