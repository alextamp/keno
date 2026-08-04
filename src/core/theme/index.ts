import { useThemeStore } from './theme.store';

// Warm Paper design system (design/KENO_WARM_PAPER_SPEC.md + KENO_v3_ADDENDUM.md).
// Terracotta is the only action color; categories are used at dot/tint size only.
export const LightColors = {
  primary: '#B8482A',
  primaryLight: '#CC5B3A',
  primaryDark: '#96371F',
  accentSoft: '#F7EBE5',
  accentInk: '#A03F24',

  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceVariant: '#EDE5D9',
  surfaceElevated: '#FFFFFF',
  border: '#E8E0D5',
  borderStrong: '#241F19',

  textPrimary: '#241F19',
  textSecondary: '#6E635A',
  textHint: '#7A6E62',
  textDecor: '#9A8E82',

  categoryParty: '#7E52A8',
  categorySports: '#3F7A55',
  categoryStudy: '#3A6494',
  categoryChill: '#B2537A',
  categoryCoffee: '#A0702C',
  categoryOther: '#7A6E62',

  error: '#DC2626',
  success: '#16A34A',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

export const DarkColors = {
  primary: '#D9603C',
  primaryLight: '#E27A55',
  primaryDark: '#B8482A',
  accentSoft: '#2C1C15',
  accentInk: '#E27A55',

  background: '#17130F',
  surface: '#1F1A15',
  surfaceVariant: '#2A231C',
  surfaceElevated: '#1F1A15',
  border: '#2E2721',
  borderStrong: '#F2EDE5',

  textPrimary: '#F2EDE5',
  textSecondary: '#B4A796',
  textHint: '#9D8F7E',
  textDecor: '#6B5F53',

  // Category dots/tints stay constant across themes per spec — they're small
  // (7px dot / 18% tint) so vibrancy loss on dark bg is an accepted tradeoff
  // for keeping category meaning/color consistent everywhere.
  categoryParty: '#7E52A8',
  categorySports: '#3F7A55',
  categoryStudy: '#3A6494',
  categoryChill: '#B2537A',
  categoryCoffee: '#A0702C',
  categoryOther: '#9D8F7E',

  error: '#F87171',
  success: '#4ADE80',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.7)',
} as const;

export type AppColors = typeof LightColors;

export function useTheme(): { colors: AppColors; isDark: boolean } {
  const isDark = useThemeStore((s) => s.isDark);
  return { colors: (isDark ? DarkColors : LightColors) as AppColors, isDark };
}

export const EVENT_CATEGORY_THEME_COLORS = {
  light: {
    party: LightColors.categoryParty,
    sports: LightColors.categorySports,
    study: LightColors.categoryStudy,
    chill: LightColors.categoryChill,
    coffee: LightColors.categoryCoffee,
    other: LightColors.categoryOther,
  },
  dark: {
    party: DarkColors.categoryParty,
    sports: DarkColors.categorySports,
    study: DarkColors.categoryStudy,
    chill: DarkColors.categoryChill,
    coffee: DarkColors.categoryCoffee,
    other: DarkColors.categoryOther,
  },
};
