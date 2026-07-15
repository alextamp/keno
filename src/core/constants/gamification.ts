export const XP_VALUES = {
  joinEvent: 10,
  createEvent: 25,
  streakBonus3: 15,
  streakBonus7: 30,
};

// Anyone who created their account before this date is considered a beta
// tester (badge is purely cosmetic, computed client-side — no schema
// migration needed). This complements the admin "Award beta badges" one-off
// batch (`isBetaTester` flag, see settings.tsx) which retroactively covers
// accounts created before `createdAt` started being recorded: the OR below
// means either signal is enough to earn the badge.
export const BETA_CUTOFF_DATE = new Date('2026-07-29T00:00:00Z');

export function isBetaTesterUser(u: { isBetaTester?: boolean; createdAt?: Date | null }): boolean {
  return !!u.isBetaTester || (!!u.createdAt && u.createdAt.getTime() < BETA_CUTOFF_DATE.getTime());
}

export interface Level {
  name: string;
  minXP: number;
  emoji: string;
  color: string;
}

export const LEVELS: Level[] = [
  { name: 'Freshman',  minXP: 0,   emoji: '🎒', color: '#8B3FCC' },
  { name: 'Sophomore', minXP: 50,  emoji: '📚', color: '#2952CC' },
  { name: 'Junior',    minXP: 150, emoji: '⭐', color: '#0A8A52' },
  { name: 'Senior',    minXP: 350, emoji: '🎓', color: '#CC6B00' },
  { name: 'GOAT',      minXP: 700, emoji: '🐐', color: '#C94D0A' },
];

export function getLevel(xp: number): Level & { next: Level | null; progress: number; xpInLevel: number; xpNeeded: number } {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXP) idx = i;
  }
  const current = LEVELS[idx];
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  const xpInLevel = xp - current.minXP;
  const xpNeeded = next ? next.minXP - current.minXP : 0;
  const progress = next ? xpInLevel / xpNeeded : 1;
  return { ...current, next, progress, xpInLevel, xpNeeded };
}
