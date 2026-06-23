export const Colors = {
  // Primary — Marker Orange
  primary: '#F26522',
  primaryLight: '#F4884A',
  primaryDark: '#D4531A',

  // Backgrounds — Notebook Cream
  background: '#FAF9F6',
  surface: '#FFFFFF',
  surfaceVariant: '#F2F0EB',
  border: '#EAE8E3',

  // Text — Charcoal
  textPrimary: '#1A1A1A',
  textSecondary: '#5C5C5C',
  textHint: '#9E9E9E',

  // Accents — Community / Nightlife
  accentPurple: '#8B5CF6',
  accentPink: '#EC4899',
  accentGreen: '#10B981',
  accentBlue: '#3B82F6',
  accentAmber: '#F59E0B',

  // Event category chips
  categoryParty: '#8B5CF6',
  categorySports: '#10B981',
  categoryStudy: '#3B82F6',
  categoryChill: '#EC4899',
  categoryCoffee: '#F59E0B',
  categoryOther: '#6B7280',

  // Status
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorKey = keyof typeof Colors;
