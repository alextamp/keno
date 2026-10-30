// Recurring events ("Κάθε Πέμπτη μπάλα"): one series doc holds the rule and
// the full list of dates; each occurrence is a normal, independent event
// (own attendees, tickets, chat, check-in). Only occurrences inside the
// rolling horizon exist as event docs — the rest are created by
// functions/src/index.ts's generateSeriesOccurrences as their date nears, so
// the feed never shows months of copies at once.

export type RepeatFrequency = 'once' | 'weekly' | 'biweekly';

export const SERIES_DEFAULT_COUNT = 8;
export const SERIES_MAX_COUNT = 26;
/** Mirrored in functions/src/index.ts (Functions can't import from src/). */
export const SERIES_HORIZON_DAYS = 28;

/**
 * Every occurrence of a series, in order, starting with `start` itself.
 * Dates keep `start`'s local time of day, built with calendar arithmetic so
 * a DST change mid-series doesn't shift the hour.
 */
export function seriesDates(
  start: Date,
  frequency: Exclude<RepeatFrequency, 'once'>,
  weekdays: number[],
  count: number,
): Date[] {
  const days = weekdays.length > 0 ? new Set(weekdays) : new Set([start.getDay()]);
  days.add(start.getDay());
  const interval = frequency === 'biweekly' ? 2 : 1;
  const total = Math.max(1, Math.min(SERIES_MAX_COUNT, Math.floor(count)));
  const out: Date[] = [];
  // Walk day by day from the Sunday of the start week; whole weeks are
  // skipped for every-2-weeks, keyed to the start week.
  for (let d = 0; out.length < total && d < 7 * interval * (SERIES_MAX_COUNT + 1); d++) {
    const candidate = new Date(
      start.getFullYear(), start.getMonth(), start.getDate() - start.getDay() + d,
      start.getHours(), start.getMinutes(),
    );
    if (Math.floor(d / 7) % interval !== 0) continue;
    if (!days.has(candidate.getDay())) continue;
    if (candidate.getTime() < start.getTime()) continue;
    out.push(candidate);
  }
  return out;
}

/** Indexes of occurrences that should exist by now but haven't been created yet. */
export function dueOccurrenceIndexes(dates: Date[], generatedCount: number, now: Date = new Date()): number[] {
  const horizon = now.getTime() + SERIES_HORIZON_DAYS * 86400000;
  const out: number[] = [];
  for (let i = generatedCount; i < dates.length; i++) {
    if (dates[i].getTime() > horizon) break;
    out.push(i);
  }
  return out;
}
