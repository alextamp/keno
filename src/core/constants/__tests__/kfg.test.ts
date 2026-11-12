import {
  countsForLeaderboard, daysUntilMonthlyReset, getKfgLevel, getKfgMonthId, KFG_COSMETICS, KFG_LEVELS, KFG_LIMITS, nextStreak,
} from '../kfg';

describe('getKfgLevel', () => {
  it('starts at level 1', () => {
    const l = getKfgLevel(0);
    expect(l.level).toBe(1);
    expect(l.name.el).toBe('Αρχάριος');
    expect(l.pointsToNext).toBe(150);
  });

  it('matches the brief: 1.240 points is level 4 (Βοηθός)', () => {
    const l = getKfgLevel(1240);
    expect(l.level).toBe(4);
    expect(l.name.el).toBe('Βοηθός');
    expect(l.next?.level).toBe(5);
    expect(l.pointsToNext).toBe(160);
    expect(l.progress).toBeCloseTo((1240 - 800) / 600);
  });

  it('switches level exactly at the threshold', () => {
    expect(getKfgLevel(1399).level).toBe(4);
    expect(getKfgLevel(1400).level).toBe(5);
  });

  it('caps at the last level with full progress', () => {
    const l = getKfgLevel(50_000);
    expect(l.level).toBe(KFG_LEVELS.length);
    expect(l.next).toBeNull();
    expect(l.progress).toBe(1);
  });

  it('has strictly increasing thresholds', () => {
    for (let i = 1; i < KFG_LEVELS.length; i++) {
      expect(KFG_LEVELS[i].minPoints).toBeGreaterThan(KFG_LEVELS[i - 1].minPoints);
    }
  });
});

describe('countsForLeaderboard', () => {
  it('never counts photo missions', () => {
    expect(countsForLeaderboard('photo', 'organization', 10)).toBe(false);
  });

  it('always counts organization QR and group missions', () => {
    expect(countsForLeaderboard('partnerQr', 'organization', 1)).toBe(true);
    expect(countsForLeaderboard('group', 'organization', 1)).toBe(true);
  });

  it('counts student missions only with enough verified people', () => {
    expect(countsForLeaderboard('partnerQr', 'student', KFG_LIMITS.studentMinVerified - 1)).toBe(false);
    expect(countsForLeaderboard('partnerQr', 'student', KFG_LIMITS.studentMinVerified)).toBe(true);
  });
});

describe('nextStreak', () => {
  const mon = new Date('2026-11-09T12:00:00');
  const wedSameWeek = new Date('2026-11-11T12:00:00');
  const nextWeek = new Date('2026-11-17T12:00:00');
  const twoWeeksLater = new Date('2026-11-24T12:00:00');

  it('starts at 1', () => {
    expect(nextStreak({ streakWeeks: 0, lastWeekId: null }, mon).streakWeeks).toBe(1);
  });

  it('does not double-count the same week', () => {
    const s = nextStreak({ streakWeeks: 0, lastWeekId: null }, mon);
    expect(nextStreak(s, wedSameWeek).streakWeeks).toBe(1);
  });

  it('grows on consecutive weeks and restarts after a gap', () => {
    const s1 = nextStreak({ streakWeeks: 0, lastWeekId: null }, mon);
    const s2 = nextStreak(s1, nextWeek);
    expect(s2.streakWeeks).toBe(2);
    const s3 = nextStreak(s1, twoWeeksLater);
    expect(s3.streakWeeks).toBe(1);
  });
});

describe('month helpers', () => {
  it('formats the month id', () => {
    expect(getKfgMonthId(new Date(2026, 10, 12))).toBe('2026-11');
    expect(getKfgMonthId(new Date(2026, 0, 1))).toBe('2026-01');
  });

  it('counts days to the reset', () => {
    expect(daysUntilMonthlyReset(new Date(2026, 10, 30, 12))).toBe(1);
    expect(daysUntilMonthlyReset(new Date(2026, 10, 12, 0))).toBe(19);
  });
});

describe('cosmetics catalog', () => {
  it('has unique ids and covers every slot', () => {
    const ids = KFG_COSMETICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(KFG_COSMETICS.map((c) => c.slot))).toEqual(new Set(['head', 'face', 'neck']));
  });
});
