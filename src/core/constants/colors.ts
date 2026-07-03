export const Colors = {
  primary: '#C94D0A',
  primaryLight: '#E05D18',
  primaryDark: '#A33D07',

  background: '#F7F3ED',
  surface: '#FFFEF9',
  surfaceVariant: '#EDE8DF',
  border: '#D6CCBE',
  borderStrong: '#1A1208',

  textPrimary: '#1A1208',
  textSecondary: '#5C4A38',
  textHint: '#A08878',

  accentPurple: '#8B3FCC',
  accentPink: '#CC1F6E',
  accentGreen: '#0A8A52',
  accentBlue: '#2952CC',
  accentAmber: '#CC6B00',

  categoryParty: '#8B3FCC',
  categorySports: '#0A8A52',
  categoryStudy: '#2952CC',
  categoryChill: '#CC1F6E',
  categoryCoffee: '#CC6B00',
  categoryOther: '#504540',

  error: '#DC2626',
  success: '#16A34A',
  warning: '#CC6B00',

  white: '#FFFFFF',
  black: '#1A1208',
} as const;

export type ColorKey = keyof typeof Colors;
