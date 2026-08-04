import React, { useEffect, useRef } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { LEVELS, CEO_LEVEL, getLevel } from '@/core/constants/gamification';
import { useTranslation } from '@/core/i18n';
import { Icon } from './Icon';
import { ProgressTrack } from './ProgressTrack';
import { Tag } from './Tag';

interface Props {
  visible: boolean;
  xp: number;
  /** Whoever's level this is — needed to know whether CEO (admin-only) is
   *  the level actually being viewed, vs. just an unreachable locked row. */
  uid?: string;
  onClose: () => void;
}

const DISMISS_DISTANCE = 700;

// Warm Paper badges (spec §4): 42px circles, 1px border, line icon. Earned =
// accent border + accent.soft bg + accent icon. Locked = border + ink.decor
// icon at full opacity. Rewards are quiet — no per-level rainbow colors.
export function LevelsModal({ visible, xp, uid, onClose }: Props) {
  const { colors } = useTheme();
  const t = useTranslation();
  const levelInfo = getLevel(xp, uid);
  // Overall journey progress (first level's 0 XP through the last level's
  // threshold), not just the current level's own segment — this is what
  // fills the bar at the top of the sheet.
  const maxXP = LEVELS[LEVELS.length - 1].minXP;
  const overallProgress = Math.min(1, xp / maxXP);

  // Drag-to-dismiss that works from anywhere on the sheet (not just the
  // header) and follows the finger live instead of only snapping on
  // release. It only takes over from the list's own scroll once the list is
  // scrolled to the top — otherwise a downward drag just scrolls normally,
  // same as every other bottom sheet with a scrollable body.
  const translateY = useSharedValue(0);
  const scrollOffsetY = useRef(0);

  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        scrollOffsetY.current <= 2 && gesture.dy > 4 && gesture.dy > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        translateY.value = Math.max(0, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 100 || gesture.vy > 0.9) {
          translateY.value = withTiming(DISMISS_DISTANCE, { duration: 200 }, (finished) => {
            if (finished) runOnJS(onClose)();
          });
        } else {
          translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        }
      },
      onPanResponderTerminate: () => {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      },
    }),
  ).current;

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleListScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    scrollOffsetY.current = e.nativeEvent.contentOffset.y;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* The backdrop is a separate sibling filling only the space above the
          sheet (not a wrapping parent) — tapping the sheet itself can never
          reach it, no matter how the responder system negotiates touches,
          so the sheet needs no tap-swallowing hack of its own. Only the
          PanResponder below (drag-to-dismiss) lives on the sheet. */}
      <View style={styles.overlay}>
        <Pressable style={styles.backdropTapArea} onPress={onClose} />
        <Animated.View
          style={[styles.sheet, { backgroundColor: colors.surface }, sheetAnimatedStyle]}
          {...panResponder.panHandlers}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{levelInfo.name}</Text>
              <Text style={[styles.subtitle, { color: colors.textHint }]}>{xp} / {maxXP} XP</Text>
            </View>
            <Tag label={`${xp} XP`} />
          </View>

          {levelInfo.next ? (
            <View style={styles.progressSection}>
              <ProgressTrack progress={overallProgress} />
              <Text style={[styles.progressLabel, { color: colors.textHint }]}>
                {t.levelsXpToNext(levelInfo.xpNeeded - levelInfo.xpInLevel, levelInfo.next.name)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.progressLabel, { color: colors.textHint, marginBottom: Spacing.base }]}>
              {t.profileLevelMaxed}
            </Text>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.list}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
          >
            {[...LEVELS, CEO_LEVEL].map((lvl) => {
              const isCeoRow = lvl.minXP === Infinity;
              const isCurrent = levelInfo.name === lvl.name;
              // The CEO row is never XP-gated — it's unlocked only when the
              // profile being viewed actually is the admin's.
              const isUnlocked = isCeoRow ? levelInfo.isCEO : xp >= lvl.minXP;
              const xpToUnlock = Math.max(0, lvl.minXP - xp);

              return (
                <View key={lvl.name} style={[styles.row, { borderTopColor: colors.border }]}>
                  <View style={[
                    styles.node,
                    isUnlocked
                      ? { backgroundColor: colors.accentSoft, borderColor: lvl.color }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}>
                    <Icon name={lvl.icon} size={19} color={isUnlocked ? lvl.color : colors.textDecor} />
                  </View>

                  <View style={styles.content}>
                    <Text style={[styles.levelName, { color: isCurrent ? lvl.color : colors.textPrimary }]}>
                      {lvl.name}
                    </Text>
                    <Text style={[styles.xpRange, { color: colors.textHint }]}>
                      {isCeoRow ? t.levelsCeoOnly : isUnlocked ? `${lvl.minXP}+ XP` : t.levelsXpToUnlock(xpToUnlock)}
                    </Text>
                  </View>

                  {isCurrent && <Tag label={t.levelsYouTag} />}
                  {isUnlocked && !isCurrent && <Icon name="check" size={16} color={lvl.color} />}
                </View>
              );
            })}
            <View style={{ height: 12 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,14,10,0.34)' },
  backdropTapArea: { flex: 1 },
  // A definite height (not maxHeight) is required here — otherwise the
  // ScrollView below can't resolve `flex: 1` against an ambiguous parent
  // size and collapses to zero height, hiding the whole level list.
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: Spacing.md, paddingHorizontal: Spacing.gutter, height: '80%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.4 },
  subtitle: { fontSize: FontSize.md, fontFamily: UIFontLight, marginTop: 2 },
  progressSection: { gap: 6, marginBottom: Spacing.base },
  progressLabel: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  list: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  node: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  levelName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  xpRange: { fontSize: FontSize.sm, fontFamily: UIFontLight, marginTop: 1 },
});
