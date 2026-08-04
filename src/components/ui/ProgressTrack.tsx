import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/core/theme';

// Warm Paper progress track (spec §4): 4px tall, radius 4, track bg, accent
// fill. The one progress component — level, quests, league, capacity.
export function ProgressTrack({ progress, style, color }: { progress: number; style?: ViewStyle; color?: string }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceVariant }, style]}>
      <View style={[styles.fill, { backgroundColor: color ?? colors.primary, width: `${pct * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
