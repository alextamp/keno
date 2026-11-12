import { getISOWeekId } from '@/core/utils/weekId';

// Keno for Good: volunteering missions, their own points, levels and
// leaderboard. Deliberately separate from XP (gamification.ts) — KfG points
// never become XP and vice versa.
//
// Every value the server enforces is mirrored in functions/src/index.ts
// (KFG_* constants there) — keep the two in sync, same as WEEKLY_QUESTS /
// WEEKLY_QUEST_REWARDS.

export type KfgMissionKind = 'partnerQr' | 'group' | 'photo';
export type KfgCreatorType = 'organization' | 'student';

export const KFG_POINTS = {
  /** Organization missions verified by QR scan; the admin/org picks a value in this range per mission. */
  partnerQrMin: 200,
  partnerQrMax: 300,
  partnerQrDefault: 250,
  group: 200,
  photo: 40,
  /** A student-created mission, for each verified participant. */
  studentMission: 150,
  /** The student who hosted it — only once at least KFG_LIMITS.studentMinVerified people were verified. */
  studentHost: 150,
} as const;

export const KFG_LIMITS = {
  /** Missions a user can have joined but not yet completed at once. */
  maxOpenParticipations: 5,
  photoMissionsPerDay: 1,
  photoMissionsPerWeek: 5,
  studentMissionsPerMonth: 2,
  /** A student mission only pays out (and only counts for the leaderboard) with this many verified participants. */
  studentMinVerified: 3,
  /** Scans are accepted from this long before the mission starts until this long after it ends. */
  scanWindowMinutes: 30,
  /** Same rotation as event check-in QR codes. */
  qrBucketMs: 30_000,
  qrToleranceMs: 45_000,
  groupConfirmWindowHours: 24,
  groupMinConfirmations: 2,
  minTrustToConfirm: 0.4,
  initialTrust: 0.5,
  photoMaxDistanceM: 150,
  /** Share of photo submissions sent to manual review even when every automatic check passed. */
  photoReviewSampleRate: 0.1,
  photoLocationRetentionDays: 30,
  /** Shown as "Προς το top N" on the leaderboard; also unlocks the matching cosmetic. */
  leaderboardTop: 100,
  prizeWinners: 3,
  maxCapacity: 200,
  maxDurationHours: 12,
} as const;

/** Which completions count toward the monthly leaderboard (photo missions only ever raise the level). */
export function countsForLeaderboard(kind: KfgMissionKind, creatorType: KfgCreatorType, verifiedCount: number): boolean {
  if (kind === 'photo') return false;
  if (creatorType === 'student') return verifiedCount >= KFG_LIMITS.studentMinVerified;
  return true;
}

export interface KfgLevel {
  level: number;
  name: { el: string; en: string };
  minPoints: number;
}

export const KFG_LEVELS: KfgLevel[] = [
  { level: 1, name: { el: 'Αρχάριος', en: 'Beginner' }, minPoints: 0 },
  { level: 2, name: { el: 'Πρόθυμος', en: 'Willing' }, minPoints: 150 },
  { level: 3, name: { el: 'Συμμετέχων', en: 'Participant' }, minPoints: 400 },
  { level: 4, name: { el: 'Βοηθός', en: 'Helper' }, minPoints: 800 },
  { level: 5, name: { el: 'Εθελοντής', en: 'Volunteer' }, minPoints: 1400 },
  { level: 6, name: { el: 'Αφοσιωμένος', en: 'Dedicated' }, minPoints: 2200 },
  { level: 7, name: { el: 'Στήριγμα', en: 'Pillar' }, minPoints: 3200 },
  { level: 8, name: { el: 'Φύλακας', en: 'Guardian' }, minPoints: 4500 },
  { level: 9, name: { el: 'Ήρωας της γειτονιάς', en: 'Neighbourhood hero' }, minPoints: 6000 },
  { level: 10, name: { el: 'Θρύλος', en: 'Legend' }, minPoints: 8000 },
];

/** Level from lifetime earned points (spending never lowers it). */
export function getKfgLevel(lifetimePoints: number): KfgLevel & {
  next: KfgLevel | null; progress: number; pointsToNext: number;
} {
  let idx = 0;
  for (let i = 0; i < KFG_LEVELS.length; i++) {
    if (lifetimePoints >= KFG_LEVELS[i].minPoints) idx = i;
  }
  const current = KFG_LEVELS[idx];
  const next = KFG_LEVELS[idx + 1] ?? null;
  if (!next) return { ...current, next: null, progress: 1, pointsToNext: 0 };
  const span = next.minPoints - current.minPoints;
  return {
    ...current,
    next,
    progress: (lifetimePoints - current.minPoints) / span,
    pointsToNext: next.minPoints - lifetimePoints,
  };
}

/** "2026-11" — the leaderboard period. The server keys on Europe/Athens; the client only uses this for display. */
export function getKfgMonthId(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Whole days left until the monthly leaderboard resets (the 1st, 00:00 local). */
export function daysUntilMonthlyReset(now: Date): number {
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Weekly streak after a verified mission in `completedAt`'s week: unchanged
 * if that week already counted, +1 if it directly follows the last counted
 * week, otherwise it restarts at 1.
 */
export function nextStreak(
  prev: { streakWeeks: number; lastWeekId: string | null },
  completedAt: Date,
): { streakWeeks: number; lastWeekId: string } {
  const weekId = getISOWeekId(completedAt);
  if (prev.lastWeekId === weekId) return { streakWeeks: prev.streakWeeks, lastWeekId: weekId };
  const previousWeekId = getISOWeekId(new Date(completedAt.getTime() - 7 * 86_400_000));
  const streakWeeks = prev.lastWeekId === previousWeekId ? prev.streakWeeks + 1 : 1;
  return { streakWeeks, lastWeekId: weekId };
}

// ── Cosmetics ───────────────────────────────────────────────────────────────
// Layered on the character SVG. Everything is either bought with KfG points
// (lowers the balance, never the level or the leaderboard) or unlocked by an
// achievement and can't be bought.

export type KfgSlot = 'head' | 'face' | 'neck';

export type KfgUnlock =
  | { type: 'price'; points: number }
  | { type: 'level'; level: number }
  | { type: 'leaderboard'; top: number };

export interface KfgCosmetic {
  id: string;
  slot: KfgSlot;
  name: { el: string; en: string };
  unlock: KfgUnlock;
}

export const KFG_COSMETICS: KfgCosmetic[] = [
  { id: 'cap_green', slot: 'head', name: { el: 'Πράσινο καπέλο', en: 'Green cap' }, unlock: { type: 'price', points: 200 } },
  { id: 'beanie', slot: 'head', name: { el: 'Σκουφάκι', en: 'Beanie' }, unlock: { type: 'price', points: 400 } },
  { id: 'sunhat', slot: 'head', name: { el: 'Ψάθινο καπέλο', en: 'Sun hat' }, unlock: { type: 'level', level: 5 } },
  { id: 'glasses_round', slot: 'face', name: { el: 'Στρογγυλά γυαλιά', en: 'Round glasses' }, unlock: { type: 'price', points: 300 } },
  { id: 'sunglasses', slot: 'face', name: { el: 'Γυαλιά ηλίου', en: 'Sunglasses' }, unlock: { type: 'price', points: 500 } },
  { id: 'hero_grin', slot: 'face', name: { el: 'Χαμόγελο ήρωα', en: "Hero's grin" }, unlock: { type: 'level', level: 8 } },
  { id: 'scarf', slot: 'neck', name: { el: 'Κασκόλ', en: 'Scarf' }, unlock: { type: 'price', points: 300 } },
  { id: 'whistle', slot: 'neck', name: { el: 'Σφυρίχτρα', en: 'Whistle' }, unlock: { type: 'price', points: 600 } },
  { id: 'medal_top100', slot: 'neck', name: { el: 'Μετάλλιο Top 100', en: 'Top 100 medal' }, unlock: { type: 'leaderboard', top: KFG_LIMITS.leaderboardTop } },
];

export function getCosmetic(id: string): KfgCosmetic | undefined {
  return KFG_COSMETICS.find((c) => c.id === id);
}
