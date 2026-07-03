import { useThemeStore } from './theme.store';

export const LightColors = {
  primary: '#C94D0A',
  primaryLight: '#E05D18',
  primaryDark: '#A33D07',

  background: '#F7F3ED',
  surface: '#FFFEF9',
  surfaceVariant: '#EDE8DF',
  surfaceElevated: '#FFFEF9',
  border: '#D6CCBE',
  borderStrong: '#1A1208',

  textPrimary: '#1A1208',
  textSecondary: '#5C4A38',
  textHint: '#A08878',

  categoryParty: '#8B3FCC',
  categorySports: '#0A8A52',
  categoryStudy: '#2952CC',
  categoryChill: '#CC1F6E',
  categoryCoffee: '#CC6B00',
  categoryOther: '#504540',

  error: '#DC2626',
  success: '#16A34A',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

export const DarkColors = {
  primary: '#E05D18',
  primaryLight: '#F07030',
  primaryDark: '#C94D0A',

  background: '#1A1510',
  surface: '#251E18',
  surfaceVariant: '#2E2520',
  surfaceElevated: '#332A22',
  border: '#3A2E26',
  borderStrong: '#F0E8DF',

  textPrimary: '#F5F0E8',
  textSecondary: '#C4B5A8',
  textHint: '#8B7870',

  categoryParty: '#A878EE',
  categorySports: '#34D399',
  categoryStudy: '#60A5FA',
  categoryChill: '#F472B6',
  categoryCoffee: '#FBBF24',
  categoryOther: '#9CA3AF',

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
