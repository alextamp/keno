import {
  athensMonthId, athensWeekId, isInScanWindow, isQrValid, KFG_LIMITS, kfgLevel, levelUnlocks, missionPoints,
  missionEligibility, nextStreak, parseQrCode, photoPairProblems, qrSignature, requiredConfirmations, resolveGroup,
  sanitizeMissionFilters, KFG_QUESTS, questProgress, questClaimId,
} from '../kfgLogic';

describe('levels and unlocks', () => {
  it('matches the client table', () => {
    expect(kfgLevel(0)).toBe(1);
    expect(kfgLevel(1240)).toBe(4);
    expect(kfgLevel(1400)).toBe(5);
    expect(kfgLevel(99999)).toBe(10);
  });

  it('unlocks level cosmetics only when crossing their level', () => {
    expect(levelUnlocks(1300, 1450)).toEqual(['sunhat']);
    expect(levelUnlocks(1450, 1600)).toEqual([]);
    expect(levelUnlocks(0, 9000).sort()).toEqual(['hard_hat', 'heart_pendant', 'hero_grin', 'lion', 'owl', 'sunhat', 'unicorn']);
    // Characters unlock the same way: the owl at level 4 (800 points).
    expect(levelUnlocks(700, 820)).toEqual(['owl']);
  });
});

describe('missionPoints', () => {
  it('ignores what a student asks for', () => {
    expect(missionPoints('partnerQr', 'student', 999)).toBe(150);
  });

  it('clamps organization QR missions to 200–300', () => {
    expect(missionPoints('partnerQr', 'organization', 999)).toBe(300);
    expect(missionPoints('partnerQr', 'organization', 10)).toBe(200);
    expect(missionPoints('partnerQr', 'organization')).toBe(250);
    expect(missionPoints('photo', 'organization', 300)).toBe(40);
    expect(missionPoints('group', 'organization', 300)).toBe(200);
  });
});

describe('Athens time', () => {
  it('uses Greek time for the month boundary', () => {
    // 23:30 UTC on 31 Oct is already 1 Nov in Athens (UTC+2).
    expect(athensMonthId(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11');
    expect(athensMonthId(new Date('2026-10-31T21:30:00Z'))).toBe('2026-10');
  });

  it('builds ISO week ids and streaks', () => {
    expect(athensWeekId(new Date('2026-11-12T10:00:00Z'))).toBe('2026-W46');
    const s1 = nextStreak({ streakWeeks: 0, lastWeekId: null }, new Date('2026-11-12T10:00:00Z'));
    const s2 = nextStreak(s1, new Date('2026-11-18T10:00:00Z'));
    expect(s2.streakWeeks).toBe(2);
    expect(nextStreak(s2, new Date('2026-12-10T10:00:00Z')).streakWeeks).toBe(1);
  });
});

describe('rotating QR', () => {
  const now = 1_800_000_000_000;
  const bucket = Math.floor(now / KFG_LIMITS.qrBucketMs);

  it('round-trips a valid code', () => {
    const sig = qrSignature('secret', 'm1_u1', bucket);
    const parsed = parseQrCode(`kfg:m1_u1:${bucket}:${sig}`);
    expect(parsed).toEqual({ participationId: 'm1_u1', bucket, sig });
    expect(isQrValid('secret', 'm1_u1', bucket, sig, now)).toBe(true);
  });

  it('rejects a wrong secret, another participation, or an old code', () => {
    const sig = qrSignature('secret', 'm1_u1', bucket);
    expect(isQrValid('other', 'm1_u1', bucket, sig, now)).toBe(false);
    expect(isQrValid('secret', 'm1_u2', bucket, sig, now)).toBe(false);
    expect(isQrValid('secret', 'm1_u1', bucket, sig, now + 5 * 60_000)).toBe(false);
  });

  it('rejects malformed codes', () => {
    expect(parseQrCode('keno:checkin:e:s:1')).toBeNull();
    expect(parseQrCode('kfg:m1_u1:abc:0123456789abcdef')).toBeNull();
    expect(parseQrCode(42)).toBeNull();
  });

  it('only accepts scans around the mission time', () => {
    const start = now;
    const end = now + 2 * 3_600_000;
    expect(isInScanWindow(start, end, start - 10 * 60_000)).toBe(true);
    expect(isInScanWindow(start, end, start - 60 * 60_000)).toBe(false);
    expect(isInScanWindow(start, end, end + 60 * 60_000)).toBe(false);
  });
});

describe('group confirmation', () => {
  it('needs 2 confirmations in bigger groups and 1 in groups of 2–3', () => {
    expect(requiredConfirmations(1)).toBe(Infinity);
    expect(requiredConfirmations(2)).toBe(1);
    expect(requiredConfirmations(3)).toBe(1);
    expect(requiredConfirmations(6)).toBe(2);
  });

  it('verifies people confirmed by trusted peers and ignores self-votes and low-trust voters', () => {
    const people = ['a', 'b', 'c', 'd'];
    const votes = [
      { from: 'a', to: 'b' }, { from: 'c', to: 'b' },
      { from: 'b', to: 'a' }, { from: 'c', to: 'a' },
      { from: 'd', to: 'd' }, { from: 'x', to: 'd' },
      { from: 'a', to: 'c' }, { from: 'd', to: 'c' },
    ];
    const { verified, trustDelta } = resolveGroup(people, votes, { d: 0.1 });
    expect(verified.sort()).toEqual(['a', 'b']);
    expect(trustDelta.d).toBe(-0.2);
    expect(trustDelta.a).toBe(-0.05);
  });
});

describe('photo pairs', () => {
  const mission = { startsAtMs: Date.parse('2026-11-14T08:00:00Z'), endsAtMs: Date.parse('2026-11-14T14:00:00Z') };
  const before = { takenAtMs: Date.parse('2026-11-14T09:00:00Z'), lat: 37.9, lng: 23.7, faces: 0 };

  it('passes a clean pair', () => {
    const after = { ...before, takenAtMs: Date.parse('2026-11-14T11:00:00Z'), lat: 37.9005 };
    expect(photoPairProblems(before, after, mission)).toEqual([]);
  });

  it('flags faces, wrong order, distance and the time window', () => {
    const after = { takenAtMs: Date.parse('2026-11-14T08:30:00Z'), lat: 38.0, lng: 23.7, faces: 1 };
    expect(photoPairProblems(before, after, mission).sort()).toEqual(['distance', 'faces', 'order']);
    const late = { ...before, takenAtMs: Date.parse('2026-11-14T18:00:00Z') };
    expect(photoPairProblems(before, late, mission)).toContain('window');
  });
});

describe('mission filters', () => {
  it('normalizes input', () => {
    expect(sanitizeMissionFilters({})).toEqual({ minAge: null, maxAge: null, allowedUniversities: [], genderFilter: 'any', soloFriendly: false });
    expect(sanitizeMissionFilters({
      minAge: 18, maxAge: 24.5, allowedUniversities: ['Any', 'ΟΠΑ', 'ΟΠΑ', 3, ''], genderFilter: 'female', soloFriendly: true,
    })).toEqual({ minAge: 18, maxAge: null, allowedUniversities: ['ΟΠΑ'], genderFilter: 'female', soloFriendly: true });
    expect(sanitizeMissionFilters({ genderFilter: 'other', minAge: 10 })).toMatchObject({ genderFilter: 'any', minAge: null });
  });

  it('rejects an impossible age range', () => {
    expect(sanitizeMissionFilters({ minAge: 25, maxAge: 20 })).toBeNull();
  });

  it('checks age and university, letting unknown values through', () => {
    const m = { minAge: 18, maxAge: 22, allowedUniversities: ['ΟΠΑ'] };
    expect(missionEligibility(m, { age: 20, universityName: 'ΟΠΑ' })).toBeNull();
    expect(missionEligibility(m, { age: 25, universityName: 'ΟΠΑ' })).toBe('age-restricted');
    expect(missionEligibility(m, { age: 20, universityName: 'ΕΜΠ' })).toBe('uni-restricted');
    expect(missionEligibility(m, {})).toBeNull();
    expect(missionEligibility({}, { age: 40, universityName: 'ΕΜΠ' })).toBeNull();
  });
});

describe('quests', () => {
  const q = (id: string) => KFG_QUESTS.find((x) => x.id === id)!;
  const done = [
    { weekId: '2026-W45', cause: 'food', creatorId: 'o1', creatorType: 'organization' as const },
    { weekId: '2026-W46', cause: 'food', creatorId: 'o2', creatorType: 'organization' as const },
    { weekId: '2026-W47', cause: 'animals', creatorId: 'o1', creatorType: 'organization' as const },
    { weekId: '2026-W47', cause: 'people', creatorId: 's1', creatorType: 'student' as const },
  ];
  it('counts weekly progress in the current week only', () => {
    expect(questProgress(q('week_one'), done, '2026-W47')).toBe(1);
    expect(questProgress(q('week_two'), done, '2026-W47')).toBe(2);
    expect(questProgress(q('week_two'), done, '2026-W46')).toBe(1);
  });
  it('a new cause is one you had not done before this week', () => {
    expect(questProgress(q('week_new_cause'), done, '2026-W47')).toBe(1);
    expect(questProgress(q('week_new_cause'), done, '2026-W46')).toBe(0);
  });
  it('lifetime challenges', () => {
    expect(questProgress(q('missions_5'), done, '2026-W47')).toBe(4);
    expect(questProgress(q('causes_3'), done, '2026-W47')).toBe(3);
    expect(questProgress(q('orgs_3'), done, '2026-W47')).toBe(2);
  });
  it('claim ids: weekly per week, challenges once', () => {
    expect(questClaimId(q('week_one'), '2026-W47')).toBe('week_one_2026-W47');
    expect(questClaimId(q('missions_5'), '2026-W47')).toBe('missions_5');
  });
});
