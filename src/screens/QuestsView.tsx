import React, { useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { WEEKLY_QUESTS } from '@/core/constants/quests';
import { VERIFIED_CHECKIN_THRESHOLD, isVerifiedUser } from '@/core/constants/gamification';
import { getISOWeekId, getSemesterId, MAX_STREAK_PAUSES_PER_SEMESTER } from '@/core/utils/weekId';
import { haptics } from '@/core/utils/haptics';
import { Card } from '@/components/ui/Card';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Tag } from '@/components/ui/Tag';
import { Icon } from '@/components/ui/Icon';

// Mockup screen 25: streak flame + freeze-token pill, 3 weekly quest cards
// with progress bars, dashed locked mystery-reward card.
export default function QuestsView() {
  const { colors } = useTheme();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const pauseStreak = useAuthStore((s) => s.pauseStreak);
  const [pausing, setPausing] = useState(false);

  const currentStreak = user?.currentStreak ?? 0;
  const longestStreak = user?.longestStreak ?? 0;
  const freezeTokens = user?.streakFreezeTokens ?? 0;

  // Exam-period streak pause (research doc #22) — a deliberate, capped
  // alternative to the automatic freeze token: for weeks you already know
  // you're skipping, not a reaction to having already missed one.
  const semesterId = getSemesterId(new Date());
  const pausesUsed = user?.streakPauses?.semesterId === semesterId ? user.streakPauses.count : 0;
  const pausesLeft = Math.max(0, MAX_STREAK_PAUSES_PER_SEMESTER - pausesUsed);
  const alreadyProtectedThisWeek = user?.lastAttendedDate === getISOWeekId(new Date());
  const canPauseStreak = currentStreak > 0 && pausesLeft > 0 && !alreadyProtectedThisWeek;

  const handlePauseStreak = async () => {
    if (!canPauseStreak || pausing) return;
    setPausing(true);
    haptics.light();
    const ok = await pauseStreak();
    setPausing(false);
    haptics[ok ? 'success' : 'error']();
  };
  // The mystery quest's condition IS the verified-badge condition, and its
  // prize IS that badge (not XP) — see gamification.ts isVerifiedUser.
  const checkInCount = user?.checkInCount ?? 0;
  const mysteryUnlocked = isVerifiedUser(checkInCount);
  const mysteryClamped = Math.min(checkInCount, VERIFIED_CHECKIN_THRESHOLD);
  const mysteryStarted = mysteryClamped > 0;

  const weekId = getISOWeekId(new Date());

  const questsWithProgress = WEEKLY_QUESTS.map((quest) => {
    const progressEntry = user?.weeklyQuests?.[quest.id];
    const progress = progressEntry && progressEntry.weekId === weekId ? progressEntry.progress : 0;
    const clamped = Math.min(progress, quest.target);
    return { quest, clamped, completed: clamped >= quest.target };
  });
  const activeQuests = questsWithProgress.filter((q) => !q.completed);
  const completedQuests = questsWithProgress.filter((q) => q.completed);

  return (
    <View style={styles.root}>
      <Card padded style={styles.streakCard}>
        <View style={styles.streakTop}>
          <View style={styles.streakLeft}>
            <Icon name="flame" size={22} color={colors.primary} />
            <View>
              <Text style={[styles.streakLine, { color: colors.textPrimary }]}>{t.questsStreakLine(currentStreak)}</Text>
              <Text style={[styles.streakBest, { color: colors.textHint }]}>{t.questsStreakBest(longestStreak)}</Text>
            </View>
          </View>
          {freezeTokens > 0 && (
            <View style={[styles.freezePill, { backgroundColor: colors.surfaceVariant }]}>
              <Icon name="snow" size={13} color={colors.textSecondary} />
              <Text style={[styles.freezePillText, { color: colors.textSecondary }]}>{freezeTokens}</Text>
            </View>
          )}
        </View>
        <ProgressTrack progress={Math.min(1, currentStreak / 7)} style={styles.streakProgress} />
        <Text style={[styles.freezeNote, { color: colors.textHint }]}>{t.questsFreezeNote}</Text>

        {currentStreak > 0 && (
          <AnimatedPressable
            onPress={handlePauseStreak}
            disabled={!canPauseStreak || pausing}
            style={[styles.pauseBtn, { borderColor: colors.border, opacity: canPauseStreak ? 1 : 0.5 }]}
          >
            <Icon name="snow" size={13} color={colors.textSecondary} />
            <Text style={[styles.pauseBtnText, { color: colors.textSecondary }]}>
              {alreadyProtectedThisWeek ? t.questsPauseAlreadySafe : t.questsPauseBtn(pausesLeft)}
            </Text>
          </AnimatedPressable>
        )}
      </Card>

      <SectionLabel label={t.questsSectionLabel} style={styles.sectionLabel} />

      <View style={styles.questGrid}>
        {activeQuests.map(({ quest, clamped }) => {
          const started = clamped > 0;
          return (
            <Card key={quest.id} padded style={styles.questCard}>
              <View style={styles.questTop}>
                <Text style={[styles.questTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {t[quest.titleKey as keyof typeof t] as string}
                </Text>
                <Tag label={`+${quest.xp} XP`} />
              </View>
              <ProgressTrack progress={clamped / quest.target} style={styles.questProgress} />
              <Text style={[styles.questProgressText, { color: colors.textHint }]}>
                {started ? t.questsProgressOf(clamped, quest.target) : t.questsNotStarted}
              </Text>
            </Card>
          );
        })}

        <View style={[styles.mysteryCard, { borderColor: mysteryUnlocked ? colors.primary : colors.border }]}>
          <Icon name={mysteryUnlocked ? 'shield' : 'gift'} size={22} color={mysteryUnlocked ? colors.primary : colors.textDecor} />
          <Text style={[styles.mysteryTitle, { color: colors.textPrimary }]}>{t.questsMysteryTitle}</Text>
          <Tag label={t.questsMysteryReward} style={styles.mysteryRewardTag} />
          {/* The "mystery" is the reward, not the action — spell out exactly
              what earns it, since a bare progress bar/number gives no hint
              what's being counted. */}
          {!mysteryUnlocked && (
            <>
              <Text style={[styles.mysteryGoal, { color: colors.textSecondary }]}>
                {t.questsMysteryGoal(VERIFIED_CHECKIN_THRESHOLD)}
              </Text>
              <ProgressTrack progress={mysteryClamped / VERIFIED_CHECKIN_THRESHOLD} style={styles.mysteryProgress} />
            </>
          )}
          <Text style={[styles.mysterySubtitle, { color: colors.textHint }]}>
            {mysteryUnlocked ? t.questsMysteryUnlocked : mysteryStarted ? t.questsProgressOf(mysteryClamped, VERIFIED_CHECKIN_THRESHOLD) : t.questsNotStarted}
          </Text>
        </View>
      </View>

      {completedQuests.length > 0 && (
        <>
          <SectionLabel label={t.questsCompletedLabel} style={styles.sectionLabel} />
          <View style={styles.questGrid}>
            {completedQuests.map(({ quest, clamped }) => (
              <Card key={quest.id} padded style={[styles.questCard, styles.questCardCompleted]}>
                <View style={styles.questTop}>
                  <View style={styles.questCompletedTitleRow}>
                    <Icon name="check" size={14} color={colors.primary} />
                    <Text style={[styles.questTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {t[quest.titleKey as keyof typeof t] as string}
                    </Text>
                  </View>
                  <Tag label={`+${quest.xp} XP`} />
                </View>
                <Text style={[styles.questProgressText, { color: colors.textHint }]}>
                  {t.questsCompletedText} · {t.questsProgressOf(clamped, quest.target)}
                </Text>
              </Card>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.base },
  streakCard: {},
  streakTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  streakLine: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  streakBest: { fontSize: 11.5, fontFamily: UIFontLight, marginTop: 1 },
  freezePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 4 },
  freezePillText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  streakProgress: { marginTop: 11, marginBottom: 7 },
  freezeNote: { fontSize: 11.5, fontFamily: UIFontLight, lineHeight: 16 },
  pauseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 9, borderRadius: BorderRadius.md, borderWidth: 1 },
  pauseBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  sectionLabel: { marginTop: 18, marginBottom: 9 },
  questGrid: { gap: 10 },
  questCard: {},
  questCardCompleted: { opacity: 0.7 },
  questCompletedTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  questTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  questTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  questProgress: { marginTop: 8 },
  questProgressText: { fontSize: 11.5, fontFamily: UIFontLight, marginTop: 6 },
  mysteryCard: { borderWidth: 1, borderStyle: 'dashed', borderRadius: BorderRadius.lg, padding: 14, alignItems: 'center' },
  mysteryTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont, marginTop: 7 },
  // Tag's own style hardcodes alignSelf: 'flex-start', which pins it to the
  // left edge of this centered card — override back to center here.
  mysteryRewardTag: { marginTop: 6, alignSelf: 'center' },
  mysteryGoal: { fontSize: FontSize.sm, fontFamily: UIFont, fontWeight: FontWeight.semibold, marginTop: 8, textAlign: 'center' },
  mysteryProgress: { alignSelf: 'stretch', marginTop: 8 },
  mysterySubtitle: { fontSize: 11.5, fontFamily: UIFontLight, marginTop: 6 },
});
