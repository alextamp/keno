// Dependency-free ISO-week id, e.g. "2026-W31". Used to lazily reset weekly
// quest progress: no scheduled/cron reset exists, so callers just compare the
// stored weekId against getISOWeekId(new Date()) on every read/write and
// zero the counter when they differ. Mirrored inline (in plain JS) in
// functions/src/index.ts, since Cloud Functions can't import from `src/`.
export function getISOWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO weeks start on Monday; shift so day 0 = Monday.
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Caps how many times "pause my streak" (auth.store.ts's pauseStreak) can be
// used per semester — the research doc's answer to punishing people for
// going dark during εξεταστική.
export const MAX_STREAK_PAUSES_PER_SEMESTER = 2;

// Coarse Greek-academic-calendar split — not meant to track exact registrar
// dates, just to reset the pause cap roughly twice a year at the same points
// real semesters turn over. Aug–Jan = χειμερινό (labeled by the year it
// starts in, so Jan 2027 is still "2026-fall"); Feb–Jul = εαρινό.
export function getSemesterId(date: Date): string {
  const month = date.getMonth(); // 0 = Jan .. 11 = Dec
  if (month === 0 || month >= 7) {
    const startYear = month === 0 ? date.getFullYear() - 1 : date.getFullYear();
    return `${startYear}-fall`;
  }
  return `${date.getFullYear()}-spring`;
}

// Same month cutoffs as getSemesterId, as an inclusive [start, end] range.
export function getSemesterBounds(date: Date): { start: Date; end: Date } {
  const month = date.getMonth();
  if (month === 0 || month >= 7) {
    const startYear = month === 0 ? date.getFullYear() - 1 : date.getFullYear();
    return { start: new Date(startYear, 7, 1), end: new Date(startYear + 1, 1, 0, 23, 59, 59, 999) };
  }
  const y = date.getFullYear();
  return { start: new Date(y, 1, 1), end: new Date(y, 7, 0, 23, 59, 59, 999) };
}
