import { createHmac, timingSafeEqual } from 'crypto';

// Pure Keno for Good rules used by kfg.ts — no Firebase imports, so they're
// unit-tested directly (functions/src/__tests__). The numbers mirror
// src/core/constants/kfg.ts; keep both in sync.

export type KfgMissionKind = 'partnerQr' | 'group' | 'photo';
export type KfgCreatorType = 'organization' | 'student';

export const KFG_POINTS = {
  partnerQrMin: 200,
  partnerQrMax: 300,
  partnerQrDefault: 250,
  group: 200,
  photo: 40,
  studentMission: 150,
  studentHost: 150,
} as const;

export const KFG_LIMITS = {
  maxOpenParticipations: 5,
  photoMissionsPerDay: 1,
  photoMissionsPerWeek: 5,
  studentMinVerified: 3,
  scanWindowMinutes: 30,
  qrBucketMs: 30_000,
  qrToleranceMs: 45_000,
  groupConfirmWindowHours: 24,
  groupMinConfirmations: 2,
  minTrustToConfirm: 0.4,
  initialTrust: 0.5,
  photoMaxDistanceM: 150,
  photoReviewSampleRate: 0.1,
  photoLocationRetentionDays: 30,
  leaderboardTop: 100,
  maxCapacity: 200,
  maxDurationHours: 12,
} as const;

export const KFG_LEVEL_THRESHOLDS = [0, 150, 400, 800, 1400, 2200, 3200, 4500, 6000, 8000];

/** Cosmetics the server needs to know about: slot, price, or what unlocks them. Mirrors KFG_COSMETICS. */
export const KFG_COSMETICS: Record<string, { slot: 'head' | 'face' | 'neck'; price?: number; level?: number; top?: number }> = {
  cap_green: { slot: 'head', price: 200 },
  beanie: { slot: 'head', price: 400 },
  sunhat: { slot: 'head', level: 5 },
  glasses_round: { slot: 'face', price: 300 },
  sunglasses: { slot: 'face', price: 500 },
  hero_grin: { slot: 'face', level: 8 },
  scarf: { slot: 'neck', price: 300 },
  whistle: { slot: 'neck', price: 600 },
  medal_top100: { slot: 'neck', top: KFG_LIMITS.leaderboardTop },
};

export function kfgLevel(lifetimePoints: number): number {
  let level = 1;
  KFG_LEVEL_THRESHOLDS.forEach((min, i) => { if (lifetimePoints >= min) level = i + 1; });
  return level;
}

/** Level-gated cosmetics newly reached when lifetime points go from `before` to `after`. */
export function levelUnlocks(before: number, after: number): string[] {
  const from = kfgLevel(before);
  const to = kfgLevel(after);
  return Object.entries(KFG_COSMETICS)
    .filter(([, c]) => c.level != null && c.level > from && c.level <= to)
    .map(([id]) => id);
}

export function countsForLeaderboard(kind: KfgMissionKind, creatorType: KfgCreatorType, verifiedCount: number): boolean {
  if (kind === 'photo') return false;
  if (creatorType === 'student') return verifiedCount >= KFG_LIMITS.studentMinVerified;
  return true;
}

/** Points a new mission pays, enforced server-side whatever the client asked for. */
export function missionPoints(kind: KfgMissionKind, creatorType: KfgCreatorType, requested?: number): number {
  if (creatorType === 'student') return KFG_POINTS.studentMission;
  if (kind === 'photo') return KFG_POINTS.photo;
  if (kind === 'group') return KFG_POINTS.group;
  const p = typeof requested === 'number' && Number.isFinite(requested) ? Math.round(requested) : KFG_POINTS.partnerQrDefault;
  return Math.min(KFG_POINTS.partnerQrMax, Math.max(KFG_POINTS.partnerQrMin, p));
}

// ── Time (leaderboard periods and streaks are Greek time) ──────────────────

const ATHENS = 'Europe/Athens';

function athensParts(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ATHENS, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

export function athensMonthId(date: Date): string {
  const { y, m } = athensParts(date);
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function athensDayId(date: Date): string {
  const { y, m, d } = athensParts(date);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** ISO week ("2026-W46") of the Athens calendar date — same algorithm as src/core/utils/weekId.ts. */
export function athensWeekId(date: Date): string {
  const { y, m, d: day } = athensParts(date);
  const d = new Date(Date.UTC(y, m - 1, day));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function nextStreak(
  prev: { streakWeeks: number; lastWeekId: string | null },
  completedAt: Date,
): { streakWeeks: number; lastWeekId: string } {
  const weekId = athensWeekId(completedAt);
  if (prev.lastWeekId === weekId) return { streakWeeks: prev.streakWeeks, lastWeekId: weekId };
  const previousWeekId = athensWeekId(new Date(completedAt.getTime() - 7 * 86_400_000));
  return { streakWeeks: prev.lastWeekId === previousWeekId ? prev.streakWeeks + 1 : 1, lastWeekId: weekId };
}

// ── Personal rotating QR ───────────────────────────────────────────────────
// `kfg:{participationId}:{bucket}:{sig}`, sig = first 16 hex of
// HMAC-SHA256(secret, `${participationId}:${bucket}`). The app computes it
// offline from the secret in kfgParticipations/{id}/private/qr (same js
// algorithm, src/features/kfg/qr.ts).

export function qrSignature(secret: string, participationId: string, bucket: number): string {
  return createHmac('sha256', secret).update(`${participationId}:${bucket}`).digest('hex').slice(0, 16);
}

export function parseQrCode(code: unknown): { participationId: string; bucket: number; sig: string } | null {
  if (typeof code !== 'string') return null;
  const parts = code.split(':');
  if (parts.length !== 4 || parts[0] !== 'kfg') return null;
  const bucket = Number(parts[2]);
  if (!parts[1] || !Number.isInteger(bucket) || !/^[0-9a-f]{16}$/.test(parts[3])) return null;
  return { participationId: parts[1], bucket, sig: parts[3] };
}

export function isQrValid(secret: string, participationId: string, bucket: number, sig: string, nowMs: number): boolean {
  const bucketMs = bucket * KFG_LIMITS.qrBucketMs;
  if (Math.abs(bucketMs - nowMs) > KFG_LIMITS.qrToleranceMs) return false;
  const expected = Buffer.from(qrSignature(secret, participationId, bucket));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Scans are accepted from scanWindowMinutes before the start to scanWindowMinutes after the end. */
export function isInScanWindow(startsAtMs: number, endsAtMs: number, nowMs: number): boolean {
  const pad = KFG_LIMITS.scanWindowMinutes * 60_000;
  return nowMs >= startsAtMs - pad && nowMs <= endsAtMs + pad;
}

// ── Group missions: peer confirmation ──────────────────────────────────────

/** Confirmations needed: 2, or a majority of the others in groups of up to 3. A lone participant can't be confirmed. */
export function requiredConfirmations(groupSize: number): number {
  if (groupSize <= 1) return Infinity;
  if (groupSize <= 3) return Math.ceil((groupSize - 1) / 2);
  return KFG_LIMITS.groupMinConfirmations;
}

/**
 * Who in a group mission counts as verified. `votes` are (from → to)
 * confirmations; only votes from participants with enough trust count, and
 * nobody can confirm themselves. Also returns each voter's trust change:
 * +0.05 per vote matching the outcome, −0.1 per vote for someone who
 * ended up unconfirmed, −0.1 for being unconfirmed yourself.
 */
export function resolveGroup(
  participants: string[],
  votes: { from: string; to: string }[],
  trust: Record<string, number>,
): { verified: string[]; trustDelta: Record<string, number> } {
  const members = new Set(participants);
  const trusted = (uid: string) => (trust[uid] ?? KFG_LIMITS.initialTrust) >= KFG_LIMITS.minTrustToConfirm;
  const seen = new Set<string>();
  const valid = votes.filter((v) => {
    const key = `${v.from}>${v.to}`;
    if (v.from === v.to || !members.has(v.from) || !members.has(v.to) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const needed = requiredConfirmations(participants.length);
  const verified = participants.filter((uid) =>
    valid.filter((v) => v.to === uid && trusted(v.from)).length >= needed);
  const verifiedSet = new Set(verified);

  const trustDelta: Record<string, number> = {};
  const add = (uid: string, d: number) => { trustDelta[uid] = Math.round(((trustDelta[uid] ?? 0) + d) * 100) / 100; };
  valid.forEach((v) => add(v.from, verifiedSet.has(v.to) ? 0.05 : -0.1));
  participants.filter((uid) => !verifiedSet.has(uid)).forEach((uid) => add(uid, -0.1));
  return { verified, trustDelta };
}

export function clampTrust(t: number): number {
  return Math.min(1, Math.max(0, Math.round(t * 100) / 100));
}

// ── Photo missions ─────────────────────────────────────────────────────────

export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface PhotoShot { takenAtMs: number; lat: number; lng: number; faces: number }

/** Automatic checks for a before/after pair; any problem sends it to manual review instead of paying out. */
export function photoPairProblems(
  before: PhotoShot,
  after: PhotoShot,
  mission: { startsAtMs: number; endsAtMs: number },
): string[] {
  const problems: string[] = [];
  if (before.faces > 0 || after.faces > 0) problems.push('faces');
  if (after.takenAtMs <= before.takenAtMs) problems.push('order');
  if (athensDayId(new Date(before.takenAtMs)) !== athensDayId(new Date(after.takenAtMs))) problems.push('day');
  if (!isInScanWindow(mission.startsAtMs, mission.endsAtMs, before.takenAtMs)
    || !isInScanWindow(mission.startsAtMs, mission.endsAtMs, after.takenAtMs)) problems.push('window');
  if (![before.lat, before.lng, after.lat, after.lng].every(Number.isFinite)
    || distanceM(before.lat, before.lng, after.lat, after.lng) > KFG_LIMITS.photoMaxDistanceM) problems.push('distance');
  return problems;
}

// ── Who may join (mirrors the regular events' filters) ──────────────────────

export type KfgGenderFilter = 'any' | 'male' | 'female';

export interface KfgMissionFilters {
  minAge: number | null;
  maxAge: number | null;
  allowedUniversities: string[];
  genderFilter: KfgGenderFilter;
  soloFriendly: boolean;
}

const ageOrNull = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isInteger(v) && v >= 16 && v <= 99 ? v : null);

/** Normalizes the creator's filters; returns null when the age range is impossible. */
export function sanitizeMissionFilters(d: Record<string, unknown>): KfgMissionFilters | null {
  const minAge = ageOrNull(d.minAge);
  const maxAge = ageOrNull(d.maxAge);
  if (minAge != null && maxAge != null && minAge > maxAge) return null;
  const unis = Array.isArray(d.allowedUniversities) ? d.allowedUniversities : [];
  const allowedUniversities = [...new Set(unis.filter(
    (u): u is string => typeof u === 'string' && u.trim().length > 0 && u.length <= 80 && u !== 'Any',
  ).map((u) => u.trim()))].slice(0, 30);
  const genderFilter: KfgGenderFilter = d.genderFilter === 'male' || d.genderFilter === 'female' ? d.genderFilter : 'any';
  return { minAge, maxAge, allowedUniversities, genderFilter, soloFriendly: d.soloFriendly === true };
}

/**
 * Same rule as the regular event page: an unknown age or university doesn't
 * block (those are optional profile fields); a known one outside the filter does.
 * Gender has no profile field, so it's a label only, as on regular events.
 */
export function missionEligibility(
  m: { minAge?: number | null; maxAge?: number | null; allowedUniversities?: string[] | null },
  u: { age?: unknown; universityName?: unknown },
): 'age-restricted' | 'uni-restricted' | null {
  const age = typeof u.age === 'number' ? u.age : null;
  if (age != null && ((m.minAge != null && age < m.minAge) || (m.maxAge != null && age > m.maxAge))) return 'age-restricted';
  const unis = m.allowedUniversities ?? [];
  const uni = typeof u.universityName === 'string' && u.universityName ? u.universityName : null;
  if (uni && unis.length > 0 && !unis.includes(uni)) return 'uni-restricted';
  return null;
}
