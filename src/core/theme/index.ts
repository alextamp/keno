import { useThemeStore } from './theme.store';

export const LightColors = {
  primary: '#F26522',
  primaryLight: '#FF7A30',
  primaryDark: '#D4531A',

  background: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceVariant: '#F0EEE9',
  surfaceElevated: '#FFFFFF',
  border: '#E8E5DE',
  borderStrong: '#D0CCC3',

  textPrimary: '#111111',
  textSecondary: '#555555',
  textHint: '#999999',

  categoryParty: '#7C3AED',
  categorySports: '#059669',
  categoryStudy: '#2563EB',
  categoryChill: '#DB2777',
  categoryCoffee: '#D97706',
  categoryOther: '#4B5563',

  error: '#DC2626',
  success: '#16A34A',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

export const DarkColors = {
  primary: '#FF7A30',
  primaryLight: '#FF9255',
  primaryDark: '#F26522',

  background: '#0E0E10',
  surface: '#1C1C1F',
  surfaceVariant: '#28282C',
  surfaceElevated: '#2C2C30',
  border: '#333338',
  borderStrong: '#48484E',

  textPrimary: '#F2F2F7',
  textSecondary: '#AEAEB2',
  textHint: '#636366',

  categoryParty: '#A78BFA',
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
  return { colors: isDark ? DarkColors : LightColors, isDark };
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
