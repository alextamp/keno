import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { UIFont, FontSize, FontWeight } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';

// Warm Paper section label (spec §3 Label): 11/700, +1.4px tracking,
// UPPERCASE, decor ink — "ΠΡΟΣΦΑΤΑ", "ΕΔΩ ΤΩΡΑ", "ΑΥΤΗ ΤΗ ΒΔΟΜΑΔΑ".
// Latin-only tracking rule doesn't apply: these are set in caps, which Greek
// tracks fine — the spec only forbids letter-spacing Greek *lowercase*.
export function SectionLabel({ label, style }: { label: string; style?: TextStyle }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.label, { color: colors.textDecor }, style]}>
      {label.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
    letterSpacing: 1.4,
  },
});
