import { formatPoints } from '../format';

describe('formatPoints', () => {
  it('groups thousands per language', () => {
    expect(formatPoints(1240, 'el')).toBe('1.240');
    expect(formatPoints(1240, 'en')).toBe('1,240');
    expect(formatPoints(999, 'el')).toBe('999');
    expect(formatPoints(1234567, 'el')).toBe('1.234.567');
  });
});
