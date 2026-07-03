import React from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { LEVELS, getLevel } from '@/core/constants/gamification';

interface Props {
  visible: boolean;
  xp: number;
  onClose: () => void;
}

export function LevelsModal({ visible, xp, onClose }: Props) {
  const { colors } = useTheme();
  const levelInfo = getLevel(xp);
  const bs = colors.borderStrong;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <AnimatedPressable style={styles.overlay} onPress={onClose}>
        <AnimatedPressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Level Roadmap</Text>
              <Text style={[styles.subtitle, { color: colors.textHint }]}>Your XP journey</Text>
            </View>
            <View style={[styles.xpBadge, { backgroundColor: levelInfo.color + '18', borderColor: levelInfo.color }]}>
              <Text style={[styles.xpBadgeNum, { color: levelInfo.color }]}>{xp}</Text>
              <Text style={[styles.xpBadgeLabel, { color: levelInfo.color }]}>XP</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {LEVELS.map((lvl, i) => {
              const isCurrent = levelInfo.name === lvl.name;
              const isUnlocked = xp >= lvl.minXP;
              const isLast = i === LEVELS.length - 1;
              const nextLvl = LEVELS[i + 1];
              const xpToUnlock = Math.max(0, lvl.minXP - xp);

              return (
                <View key={lvl.name} style={styles.row}>
                  {/* Left: connector line + node */}
                  <View style={styles.track}>
                    <View style={[
                      styles.node,
                      isUnlocked
                        ? { backgroundColor: lvl.color, borderColor: lvl.color }
                        : { backgroundColor: colors.surfaceVariant, borderColor: bs },
                      isCurrent && styles.nodeCurrent,
                    ]}>
                      <Text style={[styles.nodeEmoji, isCurrent && styles.nodeEmojiLarge]}>{lvl.emoji}</Text>
                    </View>
                    {!isLast && (
                      <View style={[
                        styles.connector,
                        { backgroundColor: isUnlocked && xp >= (nextLvl?.minXP ?? Infinity) ? lvl.color : colors.border },
                      ]} />
                    )}
                  </View>

                  {/* Right: content */}
                  <View style={[
                    styles.content,
                    isCurrent && { backgroundColor: lvl.color + '12', borderColor: lvl.color, borderWidth: 2, borderRadius: BorderRadius.lg },
                    !isLast && { marginBottom: 0 },
                  ]}>
                    <View style={styles.rowTop}>
                      <Text style={[
                        styles.levelName,
                        { color: isCurrent ? lvl.color : isUnlocked ? colors.textPrimary : colors.textHint },
                      ]}>
                        {lvl.name}
                      </Text>
                      {isCurrent && (
                        <View style={[styles.youPill, { backgroundColor: lvl.color }]}>
                          <Text style={styles.youText}>YOU</Text>
                        </View>
                      )}
                      {isUnlocked && !isCurrent && (
                        <Text style={[styles.checkmark, { color: '#059669' }]}>✓</Text>
                      )}
                      {!isUnlocked && (
                        <View style={[styles.lockedPill, { borderColor: bs }]}>
                          <Text style={[styles.lockedText, { color: colors.textHint }]}>+{xpToUnlock} XP</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.xpRange, { color: colors.textHint }]}>
                      {nextLvl ? `${lvl.minXP} – ${nextLvl.minXP - 1} XP` : `${lvl.minXP}+ XP`}
                    </Text>

                    {isCurrent && levelInfo.next && (
                      <View style={styles.progressSection}>
                        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
                          <View style={[styles.progressFill, { backgroundColor: lvl.color, width: `${Math.round(levelInfo.progress * 100)}%` as any }]} />
                        </View>
                        <Text style={[styles.progressLabel, { color: lvl.color }]}>
                          {levelInfo.xpInLevel} / {levelInfo.xpNeeded} XP · {levelInfo.xpNeeded - levelInfo.xpInLevel} to {levelInfo.next.name}
                        </Text>
                      </View>
                    )}

                    {isCurrent && !levelInfo.next && (
                      <Text style={[styles.maxLabel, { color: lvl.color }]}>Max level reached 🎉</Text>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={{ height: 12 }} />
          </ScrollView>
        </AnimatedPressable>
      </AnimatedPressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 2.5, borderBottomWidth: 0, paddingTop: Spacing.md, paddingHorizontal: Spacing.lg, maxHeight: '80%' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  subtitle: { fontSize: FontSize.sm, marginTop: 2 },
  xpBadge: { borderWidth: 2, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 6, alignItems: 'center', minWidth: 64 },
  xpBadgeNum: { fontSize: 22, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, lineHeight: 26 },
  xpBadgeLabel: { fontSize: 10, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  list: {},
  row: { flexDirection: 'row', gap: Spacing.md, marginBottom: 0 },
  track: { alignItems: 'center', width: 44 },
  node: { width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  nodeCurrent: { width: 52, height: 52, borderRadius: 26, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 4 },
  nodeEmoji: { fontSize: 20 },
  nodeEmojiLarge: { fontSize: 24 },
  connector: { width: 3, flex: 1, minHeight: 12, borderRadius: 2, marginVertical: 3 },
  content: { flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, marginBottom: Spacing.md, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelName: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, flex: 1 },
  youPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  youText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  checkmark: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
  lockedPill: { borderWidth: 1.5, borderRadius: BorderRadius.full, paddingHorizontal: 7, paddingVertical: 2 },
  lockedText: { fontSize: 10, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  xpRange: { fontSize: FontSize.xs },
  progressSection: { gap: 4, marginTop: 4 },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden', borderWidth: 1.5 },
  progressFill: { height: 7, borderRadius: 4 },
  progressLabel: { fontSize: 10, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  maxLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont },
});
