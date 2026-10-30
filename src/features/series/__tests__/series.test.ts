import { dueOccurrenceIndexes, seriesDates } from '../series';

// Thu 1 Oct 2026, 19:00
const START = new Date(2026, 9, 1, 19, 0);

describe('seriesDates', () => {
  it('repeats weekly on the start weekday, keeping the time of day', () => {
    const dates = seriesDates(START, 'weekly', [4], 4);
    expect(dates.map((d) => d.getDate())).toEqual([1, 8, 15, 22]);
    expect(dates.every((d) => d.getDay() === 4 && d.getHours() === 19)).toBe(true);
  });

  it('keeps the hour across the October DST change', () => {
    const dates = seriesDates(START, 'weekly', [4], 6);
    expect(dates[5].getDate()).toBe(5); // 5 Nov, after clocks went back on 25 Oct
    expect(dates[5].getHours()).toBe(19);
  });

  it('skips every other week for biweekly', () => {
    expect(seriesDates(START, 'biweekly', [4], 3).map((d) => d.getDate())).toEqual([1, 15, 29]);
  });

  it('supports several weekdays and never returns days before the start', () => {
    // Tue + Thu, starting on a Thursday: the Tuesday of the first week is in the past.
    const dates = seriesDates(START, 'weekly', [2, 4], 4);
    expect(dates.map((d) => `${d.getMonth() + 1}/${d.getDate()}`)).toEqual(['10/1', '10/6', '10/8', '10/13']);
  });

  it('always includes the start day and caps at 26 occurrences', () => {
    expect(seriesDates(START, 'weekly', [1], 2)[0].getTime()).toBe(START.getTime());
    expect(seriesDates(START, 'weekly', [4], 100)).toHaveLength(26);
  });
});

describe('dueOccurrenceIndexes', () => {
  it('returns only not-yet-created occurrences inside the 4-week horizon', () => {
    const dates = seriesDates(START, 'weekly', [4], 8); // Oct 1 … Nov 19
    const now = new Date(2026, 9, 1, 12);
    // Horizon ends Oct 29 12:00, so the Oct 29 19:00 occurrence isn't due yet.
    expect(dueOccurrenceIndexes(dates, 1, now)).toEqual([1, 2, 3]);
    expect(dueOccurrenceIndexes(dates, 8, now)).toEqual([]);
  });
});
