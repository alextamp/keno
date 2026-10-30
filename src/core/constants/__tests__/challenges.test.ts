import { getChallengeDefs } from '../challenges';
import { Translations } from '@/core/i18n';
import { UserEntity } from '@/features/auth/domain/entities/user.entity';

// getChallengeDefs only ever reads the challenge*Title/Desc keys and a
// handful of user fields — a full Translations/UserEntity mock would be
// hundreds of unrelated fields for no benefit, so cast a minimal stand-in.
const t = new Proxy({}, { get: (_, key) => `[${String(key)}]` }) as unknown as Translations;

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    joinedEvents: [],
    createdEvents: [],
    following: [],
    ...overrides,
  } as UserEntity;
}

describe('getChallengeDefs', () => {
  it('returns an empty list with no user (not signed in)', () => {
    expect(getChallengeDefs(null, t)).toEqual([]);
    expect(getChallengeDefs(undefined, t)).toEqual([]);
  });

  it('returns all 11 challenge definitions for a user', () => {
    expect(getChallengeDefs(makeUser(), t)).toHaveLength(11);
  });

  it('clamps current progress at each challenge\'s own target, never above it', () => {
    const user = makeUser({ joinedEvents: Array.from({ length: 999 }, (_, i) => `e${i}`) });
    const defs = getChallengeDefs(user, t);
    const join1 = defs.find((d) => d.id === 'join_1')!;
    const join25 = defs.find((d) => d.id === 'join_25')!;
    expect(join1.current).toBe(join1.target);
    expect(join25.current).toBe(25);
  });

  it('tracks joined/created/streak/following counts independently', () => {
    const user = makeUser({
      joinedEvents: ['a', 'b'],
      createdEvents: ['c'],
      currentStreak: 3,
      following: ['x', 'y', 'z', 'w'],
    });
    const defs = getChallengeDefs(user, t);
    expect(defs.find((d) => d.id === 'join_5')!.current).toBe(2);
    expect(defs.find((d) => d.id === 'create_1')!.current).toBe(1);
    expect(defs.find((d) => d.id === 'streak_3')!.current).toBe(3);
    expect(defs.find((d) => d.id === 'follow_5')!.current).toBe(4);
  });

  // checkin_1 deliberately tracks checkInCount (real attendance), never
  // joinedEvents (an RSVP) — see the "Νέος στην πόλη" newcomer-mode spec.
  it('tracks checkin_1 off checkInCount, independent of joinedEvents', () => {
    const rsvpOnly = getChallengeDefs(makeUser({ joinedEvents: ['a'], checkInCount: 0 }), t);
    expect(rsvpOnly.find((d) => d.id === 'checkin_1')!.current).toBe(0);
    const checkedIn = getChallengeDefs(makeUser({ joinedEvents: [], checkInCount: 1 }), t);
    expect(checkedIn.find((d) => d.id === 'checkin_1')!.current).toBe(1);
  });

  it('treats a missing currentStreak/following as zero, not a crash', () => {
    const defs = getChallengeDefs(makeUser(), t);
    expect(defs.find((d) => d.id === 'streak_3')!.current).toBe(0);
    expect(defs.find((d) => d.id === 'follow_5')!.current).toBe(0);
  });
});
