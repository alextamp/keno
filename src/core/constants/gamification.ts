export const XP_VALUES = {
  joinEvent: 10,
  createEvent: 25,
  streakBonus3: 15,
  streakBonus7: 30,
  // Anti-Flake system. Stakes need to actually sting to work as a
  // commitment device — the old 3/5/10 tier was smaller than the checkin
  // bonus itself, so there was nothing real on the line.
  rsvpStakeOptions: [15, 30, 60],
  defaultRsvpStake: 30,
  checkinBonus: 5,
  // Charged on top of a forfeited stake (or on its own, for a no-stake
  // event) when someone joins and never checks in — see the scheduled
  // markNoShows function in functions/src/index.ts.
  noShowPenalty: 15,
  // Steeper than noShowPenalty — a host no-show doesn't just cost the host,
  // it strands everyone who showed up. See markNoShows in functions/src/index.ts.
  hostNoShowPenalty: 30,
  // One-time reward for claiming the stand-in host role and running check-in
  // when the creator never showed. Awarded once, at the same markNoShows pass.
  standInHostBonus: 20,
  // One-time bonus the first time someone answers "did you come alone?"
  // with yes — rewards the scariest first step (showing up solo) rather
  // than punishing it.
  firstSoloAttendance: 20,
  // Referral reward — check-in-based, not install-based (see EventEntity.referredBy).
  // Awarded to both the inviter and the invitee, server-side only
  // (functions/src/index.ts onCheckInCreated), the moment the invited
  // friend's QR scan actually lands, never just for opening the invite.
  // Mirrored in functions/src/index.ts since Functions can't import from src/.
  referralBonus: 20,
  // Group check-in bonus (research doc #32) — 3+ mutually-following friends
  // all checked into the same event. Awarded server-side only
  // (functions/src/index.ts onCheckInCreated). Mirrored there since
  // Functions can't import from src/.
  groupCheckinBonus: 15,
};

// How long after an event's start time we wait, with zero sign the creator
// showed up (no hostArrivedAt), before offering attendees the option to
// claim stand-in host. Mirrored in functions/src/index.ts (claimStandInHost)
// since Functions can't import from src/.
export const HOST_GRACE_PERIOD_MS = 20 * 60 * 1000;

// Anyone who created their account before this date is considered a beta
// tester (badge is purely cosmetic, computed client-side — no schema
// migration needed). Frozen at the point the badge was closed off to new
// signups — do not move this date forward.
export const BETA_CUTOFF_DATE = new Date('2026-07-28T00:00:00Z');

export function isBetaTesterUser(u: { isBetaTester?: boolean; createdAt?: Date | null }): boolean {
  return !!u.isBetaTester || (!!u.createdAt && u.createdAt.getTime() < BETA_CUTOFF_DATE.getTime());
}

import { IconName } from '@/components/ui/Icon';
import { FOUNDER_UID } from './founder';

export interface Level {
  name: string;
  minXP: number;
  icon: IconName;
  /** Kept for the level-line accent on Profile; badges themselves use a
   *  flat accent/decor treatment per the Warm Paper "quiet rewards" rule. */
  color: string;
}

// Roughly ~1.4x XP per rung — GOAT (the top level anyone can actually earn)
// needs 11,000 XP, about 15x the old 700 XP ceiling, so it's a real 90-day
// stretch goal instead of something a single active week blows past.
export const LEVELS: Level[] = [
  { name: 'Freshman',  minXP: 0,     icon: 'star',   color: '#B8482A' },
  { name: 'Sophomore', minXP: 100,   icon: 'edit',   color: '#B8482A' },
  { name: 'Junior',    minXP: 250,   icon: 'zap',    color: '#B8482A' },
  { name: 'Senior',    minXP: 500,   icon: 'trophy', color: '#B8482A' },
  { name: 'Graduate',  minXP: 900,   icon: 'check',  color: '#B8482A' },
  { name: 'Alumnus',   minXP: 1500,  icon: 'shield', color: '#B8482A' },
  { name: 'Scholar',   minXP: 2300,  icon: 'doc',    color: '#B8482A' },
  { name: 'Veteran',   minXP: 3400,  icon: 'flame',  color: '#B8482A' },
  { name: 'Champion',  minXP: 4800,  icon: 'flag',   color: '#B8482A' },
  { name: 'Legend',    minXP: 6500,  icon: 'gift',   color: '#B8482A' },
  { name: 'Icon',      minXP: 8500,  icon: 'eye',    color: '#B8482A' },
  { name: 'GOAT',      minXP: 11000, icon: 'sun',    color: '#B8482A' },
];

// Founder-only rung, shown at the top of the LevelsModal roadmap but never
// reachable through XP — getLevel() only returns it for FOUNDER_UID, so no
// amount of grinding lets anyone else earn it (including a future
// moderator added to the admins collection — that's a separate, unrelated
// system, see core/utils/adminRole.ts).
export const CEO_LEVEL: Level = { name: 'CEO', minXP: Infinity, icon: 'crown', color: '#D4AF37' };

export function getLevel(xp: number, uid?: string): Level & { next: Level | null; progress: number; xpInLevel: number; xpNeeded: number; isCEO: boolean } {
  if (uid === FOUNDER_UID) {
    return { ...CEO_LEVEL, next: null, progress: 1, xpInLevel: 0, xpNeeded: 0, isCEO: true };
  }
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXP) idx = i;
  }
  const current = LEVELS[idx];
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  const xpInLevel = xp - current.minXP;
  const xpNeeded = next ? next.minXP - current.minXP : 0;
  const progress = next ? xpInLevel / xpNeeded : 1;
  return { ...current, next, progress, xpInLevel, xpNeeded, isCEO: false };
}

// Anti-Flake Reliability Badge thresholds — still used for the plain "82%"
// color coding next to a name (event/[id].tsx, user/[uid].tsx). The old
// text label ("Building" etc.) shown standalone next to the level badge was
// dropped — out of context it read as a random word, not a trust signal —
// in favor of the binary verified badge below.
export type ReliabilityBadge = 'excellent' | 'good' | 'low';

export interface ReliabilityInfo {
  badge: ReliabilityBadge;
  score: number;
  icon: IconName;
  color: string;
}

// Monochrome per the Warm Paper "quiet rewards" rule: earned states use the
// single accent color, not a traffic-light palette; only the unearned/building
// state falls back to the neutral decorative tone.
export function getReliabilityBadge(score: number): ReliabilityInfo {
  if (score >= 90) {
    return { badge: 'excellent', score, icon: 'shield', color: '#B8482A' };
  }
  if (score >= 70) {
    return { badge: 'good', score, icon: 'check', color: '#B8482A' };
  }
  return { badge: 'low', score, icon: 'clock', color: '#9A8E82' };
}

// Check-ins needed to earn the "verified" badge — a simple, honest signal
// that someone actually shows up to what they join (not just a percentage
// score). This is also the mystery quest's unlock condition (see
// quests.ts VERIFIED_CHECKIN_THRESHOLD re-export) — the mystery prize IS
// this badge, not XP.
export const VERIFIED_CHECKIN_THRESHOLD = 5;

export function isVerifiedUser(checkInCount: number | undefined): boolean {
  return (checkInCount ?? 0) >= VERIFIED_CHECKIN_THRESHOLD;
}

// "Regular" consistency badge — tied directly to the weekly streak
// (currentStreak >= 1, i.e. "active this week or currently protected by a
// freeze token"). Kept in near-real-time by functions/src/index.ts's
// sweepStreaks, which proactively consumes a banked freeze token on the
// first missed week and zeroes currentStreak (dropping the badge) if a
// second week passes with no token left — not just lazily recalculated
// the next time the user happens to check in again.
export function isRegularUser(currentStreak: number | undefined): boolean {
  return (currentStreak ?? 0) >= 1;
}

// Calculate reliability score from attendance history (last 10 events)
export function calculateReliabilityScore(
  attendanceHistory: Record<string, { checkedIn: boolean; xpStaked: number; date: string }> | undefined
): number {
  if (!attendanceHistory || Object.keys(attendanceHistory).length === 0) {
    return 0;
  }
  const entries = Object.values(attendanceHistory);
  const recent = entries.slice(-10); // Last 10 events
  const checkedIn = recent.filter((e) => e.checkedIn).length;
  return Math.round((checkedIn / recent.length) * 100);
}
