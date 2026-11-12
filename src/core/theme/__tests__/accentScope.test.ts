import { DarkColors, LightColors, resolveColors } from '@/core/theme';

// theme.store pulls in AsyncStorage/react-native, which the node test env
// can't load; resolveColors doesn't need it. (jest hoists this above imports.)
jest.mock('@/core/theme/theme.store', () => ({ useThemeStore: jest.fn() }));

describe('resolveColors', () => {
  it('leaves the default scope untouched', () => {
    expect(resolveColors(false, 'default')).toBe(LightColors);
    expect(resolveColors(true, 'default')).toBe(DarkColors);
  });

  it('swaps the action colors to green in the kfg scope', () => {
    const c = resolveColors(false, 'kfg');
    expect(c.primary).toBe('#3F7A55');
    expect(c.accentSoft).toBe('#E6EFE9');
    expect(c.accentInk).toBe('#2F5C40');
    expect(c.background).toBe(LightColors.background);
    expect(c.border).toBe(LightColors.border);
  });

  it('uses the dark green variants in dark mode', () => {
    const c = resolveColors(true, 'kfg');
    expect(c.primary).toBe(DarkColors.kfgAccent);
    expect(c.background).toBe(DarkColors.background);
  });

  it('returns a stable object per theme so it is safe in hook deps', () => {
    expect(resolveColors(false, 'kfg')).toBe(resolveColors(false, 'kfg'));
    expect(resolveColors(true, 'kfg')).toBe(resolveColors(true, 'kfg'));
  });
});
