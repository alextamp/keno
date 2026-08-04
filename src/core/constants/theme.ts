import { TextStyle } from 'react-native';
import { Colors } from './colors';

// Warm Paper spacing scale (spec §2): 4 · 8 · 12 · 16 · 20 · 24 · 30.
// Screen gutter = 20 (Spacing.gutter).
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  gutter: 20,
  lg: 24,
  xl: 30,
  xxl: 48,
} as const;

// One radius per element class (spec rule 4): cards 14 · buttons 11 ·
// small buttons/thumbs 9 · thumb 8 · pills 999.
export const BorderRadius = {
  xs: 8,   // thumbs
  sm: 9,   // small buttons
  md: 11,  // buttons, inputs
  lg: 14,  // cards, sheets
  xl: 20,  // large sheets
  full: 9999,
} as const;

// Warm Paper type scale (spec §3):
// Label 11 · Micro 12 · Meta 13 · Body 14 · Strong 15 · Card 17.5 · Title 21 · Display 26
export const FontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 15,
  xl: 17.5,
  xxl: 21,
  xxxl: 24,
  display: 26,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '700' as const, // Warm Paper never goes past 700
};

// Warm Paper typography (design/KENO_v3_ADDENDUM.md §1): Lora for titles,
// Inter for everything else. Both loaded via expo-font in the root layout
// and both ship real Greek glyphs. Never use TitleFont below ~16px and
// never use UIFont above ~20px — that split is the whole system.
export const TitleFont = 'Lora_700Bold';
export const UIFont = 'Inter_700Bold';
export const UIFontLight = 'Inter_400Regular';

// Wordmark font ("keno."), also Lora per the addendum's wordmark spec —
// lowercase, Lora 700, tracking -1px, period in terracotta.
export const LogoFont = 'Lora_700Bold';

export const Typography = {
  displayLarge: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    fontFamily: TitleFont,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  } satisfies TextStyle,
  headingLarge: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    fontFamily: TitleFont,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  } satisfies TextStyle,
  headingMedium: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    fontFamily: TitleFont,
    color: Colors.textPrimary,
    letterSpacing: -0.25,
  } satisfies TextStyle,
  titleLarge: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    fontFamily: TitleFont,
    color: Colors.textPrimary,
    letterSpacing: -0.25,
  } satisfies TextStyle,
  titleMedium: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  bodyLarge: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
    fontFamily: UIFontLight,
    color: Colors.textPrimary,
    lineHeight: 21,
  } satisfies TextStyle,
  bodyMedium: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
    fontFamily: UIFontLight,
    color: Colors.textPrimary,
    lineHeight: 21,
  } satisfies TextStyle,
  bodySmall: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    fontFamily: UIFontLight,
    color: Colors.textSecondary,
    lineHeight: 19,
  } satisfies TextStyle,
  label: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  caption: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    fontFamily: UIFontLight,
    color: Colors.textHint,
  } satisfies TextStyle,
} as const;

// Warm Paper is shadowless (spec rule 3). The single sanctioned exception is
// the map bottom sheet / floating sheet, which gets this barely-there lift.
// sm/md are kept as aliases so unmigrated call sites soften instead of break;
// they must not be used in new code.
const sheetShadow = {
  shadowColor: '#241F19',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 4,
};
export const Shadow = {
  sheet: sheetShadow,
  sm: sheetShadow,
  md: sheetShadow,
} as const;
