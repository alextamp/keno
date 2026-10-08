import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/core/theme';
import { UIFont, FontSize, FontWeight, BorderRadius, Spacing } from '@/core/constants/theme';
import { ChallengeDef } from '@/core/constants/challenges';

// Shared between ProfileTab's compact card and the full /(app)/challenges
// page — same row, same styling, one definition.
export function ChallengeRow({ challenge }: { challenge: ChallengeDef }) {
  const { colors } = useTheme();
  const done = challenge.current >= challenge.target;
  const pct = done ? 1 : challenge.current / challenge.target;

  return (
    <View style={[styles.row, { opacity: done ? 0.5 : 1 }]}>
      <Text style={styles.emoji}>{challenge.emoji}</Text>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{challenge.title}</Text>
          <View style={[styles.xpPill, { backgroundColor: done ? colors.success : colors.primary + '22', borderColor: done ? colors.success : colors.primary }]}>
            <Text style={[styles.xpPillText, { color: done ? '#fff' : colors.primary }]}>{done ? '✓' : `+${challenge.xp} XP`}</Text>
          </View>
        </View>
        <Text style={[styles.desc, { color: colors.textHint }]}>{challenge.desc}</Text>
        <View style={[styles.track, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
          <View style={[styles.fill, { width: `${pct * 100}%` as any, backgroundColor: done ? colors.success : colors.primary }]} />
        </View>
        <Text style={[styles.progress, { color: colors.textHint }]}>{challenge.current}/{challenge.target}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  emoji: { fontSize: 22, marginTop: 2 },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: UIFont, flex: 1 },
  xpPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  xpPillText: { fontSize: 10, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  desc: { fontSize: FontSize.xs, lineHeight: 16 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', borderWidth: 1, marginTop: 2 },
  fill: { height: 5, borderRadius: 3 },
  progress: { fontSize: 9, fontWeight: FontWeight.bold, textAlign: 'right' },
});
