import { Platform, TextStyle } from 'react-native';
import { Colors } from './colors';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 32,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// Loaded via expo-font/@expo-google-fonts/comfortaa in the root layout.
// Chosen specifically because it has real Greek glyph coverage (most
// hand-drawn/marker Google Fonts are Latin-only and silently fall back to a
// generic system font for Greek text) while still having character.
export const DrawFont = 'Comfortaa_700Bold';
export const DrawFontLight = 'Comfortaa_400Regular';

// Original chalk wordmark font, kept for the "KeNo." brand mark specifically
// (splash screen, sign-in, share card) — not used for general UI text since
// it's iOS-only and has no Greek glyphs, which is exactly why DrawFont above
// moved to Comfortaa. Fine here: it's a few characters of branding, not copy.
export const LogoFont = Platform.OS === 'ios' ? 'ChalkboardSE-Bold' : undefined;

export const Typography = {
  displayLarge: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  } satisfies TextStyle,
  headingLarge: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  } satisfies TextStyle,
  headingMedium: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  titleLarge: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  titleMedium: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  bodyLarge: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  bodyMedium: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    color: Colors.textPrimary,
  } satisfies TextStyle,
  bodySmall: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    color: Colors.textSecondary,
  } satisfies TextStyle,
  label: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    letterSpacing: 0.1,
  } satisfies TextStyle,
  caption: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.regular,
    color: Colors.textHint,
  } satisfies TextStyle,
} as const;

// Offset shadow = hand-drawn "stamp" look
export const Shadow = {
  sm: {
    shadowColor: '#1A1208',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    elevation: 4,
  },
  md: {
    shadowColor: '#1A1208',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    elevation: 6,
  },
} as const;
