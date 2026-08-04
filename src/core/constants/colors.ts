// Static (light-only) copy of src/core/theme LightColors, kept for the
// handful of consumers (Typography defaults below) that need a color value
// outside of the useTheme() hook. Prefer useTheme() wherever dark mode matters.
export const Colors = {
  primary: '#B8482A',
  primaryLight: '#CC5B3A',
  primaryDark: '#96371F',

  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceVariant: '#EDE5D9',
  border: '#E8E0D5',
  borderStrong: '#241F19',

  textPrimary: '#241F19',
  textSecondary: '#6E635A',
  textHint: '#7A6E62',

  accentPurple: '#7E52A8',
  accentPink: '#B2537A',
  accentGreen: '#3F7A55',
  accentBlue: '#3A6494',
  accentAmber: '#A0702C',

  categoryParty: '#7E52A8',
  categorySports: '#3F7A55',
  categoryStudy: '#3A6494',
  categoryChill: '#B2537A',
  categoryCoffee: '#A0702C',
  categoryOther: '#7A6E62',

  error: '#DC2626',
  success: '#16A34A',
  warning: '#A0702C',

  white: '#FFFFFF',
  black: '#241F19',
} as const;

export type ColorKey = keyof typeof Colors;
