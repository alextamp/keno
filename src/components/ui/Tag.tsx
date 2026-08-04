import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { UIFont, BorderRadius, FontWeight } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';

// Warm Paper tag (mockup .tag): small pill label — "+15 XP", "ΔΩΡΕΑΝ", "Νέα",
// unread counts. Accent variant = accent.soft bg + accent.ink text;
// neutral = border-color bg + dim text.
export function Tag({ label, variant = 'accent', style }: { label: string; variant?: 'accent' | 'neutral'; style?: ViewStyle }) {
  const { colors } = useTheme();
  const accent = variant === 'accent';
  return (
    <View style={[styles.tag, { backgroundColor: accent ? colors.accentSoft : colors.surfaceVariant }, style]}>
      <Text style={[styles.label, { color: accent ? colors.accentInk : colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 9.5,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
    letterSpacing: 0.3,
  },
});
