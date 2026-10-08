import { formatMessageTime, getCountdown } from '../time';

describe('formatMessageTime', () => {
  const NOW = new Date('2026-10-08T12:00:00Z');

  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('says "now" for anything under a minute', () => {
    expect(formatMessageTime(new Date('2026-10-08T11:59:30Z'))).toBe('now');
    expect(formatMessageTime(new Date('2026-10-08T11:59:30Z'), 'el')).toBe('τώρα');
  });

  it('shows minutes ago under an hour', () => {
    expect(formatMessageTime(new Date('2026-10-08T11:45:00Z'))).toBe('15m ago');
  });

  it('shows hours ago under 24h', () => {
    expect(formatMessageTime(new Date('2026-10-08T06:00:00Z'))).toBe('6h ago');
  });

  it('says "yesterday" for exactly 1 day', () => {
    expect(formatMessageTime(new Date('2026-10-07T12:00:00Z'))).toBe('yesterday');
    expect(formatMessageTime(new Date('2026-10-07T12:00:00Z'), 'el')).toBe('χθες');
  });

  // Regression test: this used to be hardcoded to always say "yesterday"
  // for anything past 24h old, so a week-old notification read identically
  // to one from yesterday. Fixed to show an actual day-count, then a date.
  it('shows a day count between 2 and 6 days, not "yesterday"', () => {
    expect(formatMessageTime(new Date('2026-10-05T12:00:00Z'))).toBe('3d ago');
    expect(formatMessageTime(new Date('2026-10-05T12:00:00Z'), 'el')).toBe('3μ πριν');
  });

  it('falls back to an actual date at 7+ days', () => {
    expect(formatMessageTime(new Date('2026-09-20T12:00:00Z'))).toBe('20 Sep');
  });
});

describe('getCountdown', () => {
  const NOW = new Date('2026-10-08T12:00:00Z');

  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('says "ended" for a past event', () => {
    expect(getCountdown(new Date('2026-10-08T11:00:00Z')).label).toBe('ended');
    expect(getCountdown(new Date('2026-10-08T11:00:00Z')).urgent).toBe(false);
  });

  it('is urgent under an hour away', () => {
    const result = getCountdown(new Date('2026-10-08T12:30:00Z'));
    expect(result.label).toBe('in 30m');
    expect(result.urgent).toBe(true);
  });

  it('is urgent under 3 hours away, not urgent beyond that', () => {
    expect(getCountdown(new Date('2026-10-08T14:00:00Z')).urgent).toBe(true);
    expect(getCountdown(new Date('2026-10-08T20:00:00Z')).urgent).toBe(false);
  });

  it('says "tomorrow" for exactly 1 day out', () => {
    expect(getCountdown(new Date('2026-10-09T12:00:00Z')).label).toBe('tomorrow');
  });
});
