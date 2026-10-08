import {
  calculateReliabilityScore, getLevel, getReliabilityBadge, isBetaTesterUser, isRegularUser, isVerifiedUser,
  LEVELS, VERIFIED_CHECKIN_THRESHOLD,
} from '../gamification';

describe('getLevel', () => {
  it('starts everyone at Freshman', () => {
    expect(getLevel(0).name).toBe('Freshman');
  });

  it('picks the highest level the xp qualifies for', () => {
    expect(getLevel(99).name).toBe('Freshman');
    expect(getLevel(100).name).toBe('Sophomore');
    expect(getLevel(11000).name).toBe('GOAT');
  });

  it('computes progress toward the next level', () => {
    // Sophomore starts at 100, Junior at 250 -> halfway is 175
    const result = getLevel(175);
    expect(result.name).toBe('Sophomore');
    expect(result.xpInLevel).toBe(75);
    expect(result.xpNeeded).toBe(150);
    expect(result.progress).toBeCloseTo(0.5);
  });

  it('caps progress at 1 with no next level past GOAT', () => {
    const result = getLevel(50000);
    expect(result.name).toBe('GOAT');
    expect(result.next).toBeNull();
    expect(result.progress).toBe(1);
  });

  it('only grants the CEO rung to the founder uid, never by xp alone', () => {
    expect(getLevel(0, 'some-other-uid').isCEO).toBe(false);
    expect(getLevel(999999, 'some-other-uid').name).not.toBe('CEO');
  });

  it('every level is reachable in ascending xp order', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minXP).toBeGreaterThan(LEVELS[i - 1].minXP);
    }
  });
});

describe('isVerifiedUser', () => {
  it('requires the full check-in threshold', () => {
    expect(isVerifiedUser(VERIFIED_CHECKIN_THRESHOLD - 1)).toBe(false);
    expect(isVerifiedUser(VERIFIED_CHECKIN_THRESHOLD)).toBe(true);
    expect(isVerifiedUser(undefined)).toBe(false);
  });
});

describe('isRegularUser / isBetaTesterUser', () => {
  it('is regular with any active streak', () => {
    expect(isRegularUser(0)).toBe(false);
    expect(isRegularUser(1)).toBe(true);
    expect(isRegularUser(undefined)).toBe(false);
  });

  it('is a beta tester if the flag is set or the account predates the cutoff', () => {
    expect(isBetaTesterUser({ isBetaTester: true })).toBe(true);
    expect(isBetaTesterUser({ createdAt: new Date('2026-01-01') })).toBe(true);
    expect(isBetaTesterUser({ createdAt: new Date('2026-12-01') })).toBe(false);
    expect(isBetaTesterUser({})).toBe(false);
  });
});

describe('calculateReliabilityScore', () => {
  it('is 0 with no attendance history', () => {
    expect(calculateReliabilityScore(undefined)).toBe(0);
    expect(calculateReliabilityScore({})).toBe(0);
  });

  it('is the percentage of checked-in events, rounded', () => {
    const history = {
      e1: { checkedIn: true, xpStaked: 10, date: '2026-01-01' },
      e2: { checkedIn: true, xpStaked: 10, date: '2026-01-02' },
      e3: { checkedIn: false, xpStaked: 10, date: '2026-01-03' },
    };
    expect(calculateReliabilityScore(history)).toBe(67);
  });

  it('only looks at the last 10 events', () => {
    const history: Record<string, { checkedIn: boolean; xpStaked: number; date: string }> = {};
    for (let i = 0; i < 15; i++) {
      history[`e${i}`] = { checkedIn: i >= 5, xpStaked: 10, date: `2026-01-${i + 1}` };
    }
    // Object.values preserves insertion order for these string keys, so the
    // "last 10" are e5..e14, all checked in.
    expect(calculateReliabilityScore(history)).toBe(100);
  });
});

describe('getReliabilityBadge', () => {
  it('buckets by score threshold', () => {
    expect(getReliabilityBadge(95).badge).toBe('excellent');
    expect(getReliabilityBadge(90).badge).toBe('excellent');
    expect(getReliabilityBadge(89).badge).toBe('good');
    expect(getReliabilityBadge(70).badge).toBe('good');
    expect(getReliabilityBadge(69).badge).toBe('low');
  });
});
