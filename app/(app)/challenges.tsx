import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ChallengeRow } from '@/components/ui/ChallengeRow';
import { Icon } from '@/components/ui/Icon';
import { FontSize, UIFontLight, Spacing, BorderRadius } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useTheme } from '@/core/theme';
import { useTranslation } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { getChallengeDefs } from '@/core/constants/challenges';
import { isNewcomerUser } from '@/core/constants/gamification';
import QuestsView from '@/screens/QuestsView';

// While "Νέος στην πόλη" (newcomer mode) is active, only these two
// challenges are reachable — everything else (including weekly quests)
// renders locked/dimmed, per the mode's own design: give a brand-new
// account exactly two things to do instead of a wall of 10+ options.
const NEWCOMER_UNLOCKED_IDS = ['create_1', 'checkin_1'];

// Weekly quests (used to live as their own Leaderboard tab, which didn't
// really fit next to rankings) and lifetime challenges (previously capped
// to a few rows on Profile) are the same idea at different timescales — one
// "Αποστολές" page now covers both, reached from Profile's Challenges card.
export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isNewcomer = isNewcomerUser(user?.checkInCount);
  const challenges = getChallengeDefs(user, t);
  const claimOrder = user?.claimedChallengeIds ?? [];
  const activeChallenges = challenges.filter((c) => c.current < c.target);
  const doneChallenges = challenges
    .filter((c) => c.current >= c.target)
    .sort((a, b) => claimOrder.indexOf(a.id) - claimOrder.indexOf(b.id));

  const unlockedChallenges = [...activeChallenges, ...doneChallenges]
    .filter((c) => NEWCOMER_UNLOCKED_IDS.includes(c.id));
  const lockedChallenges = [...activeChallenges, ...doneChallenges]
    .filter((c) => !NEWCOMER_UNLOCKED_IDS.includes(c.id));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: Spacing.gutter, paddingTop: insets.top + 12 }}>
        <ScreenHeader title={t.profileChallengesTitle} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {isNewcomer ? (
          <>
            <View style={[styles.introBanner, { backgroundColor: colors.accentSoft }]}>
              <View style={styles.introIcon}>
                <Icon name="star" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.introText, { color: colors.accentInk }]}>{t.newcomerChallengesIntro}</Text>
            </View>

            <View style={styles.list}>
              {unlockedChallenges.map((c) => <ChallengeRow key={c.id} challenge={c} />)}
            </View>

            <SectionLabel label={t.newcomerLockedNote} style={styles.sectionLabel} />
            <View style={styles.list}>
              {lockedChallenges.map((c) => (
                <View key={c.id} style={styles.lockedRow} pointerEvents="none">
                  <View style={styles.lockedRowContent}>
                    <ChallengeRow challenge={c} />
                  </View>
                  <View style={[styles.lockBadge, { backgroundColor: colors.surfaceVariant }]}>
                    <Icon name="lock" size={12} color={colors.textHint} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <QuestsView />

            <SectionLabel label={t.profileChallengesSectionLabel} style={styles.sectionLabel} />
            <View style={styles.list}>
              {[...activeChallenges, ...doneChallenges].map((c) => <ChallengeRow key={c.id} challenge={c} />)}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 4 },
  sectionLabel: { marginTop: 18, marginBottom: 9, marginHorizontal: Spacing.gutter },
  list: { paddingHorizontal: Spacing.gutter, gap: Spacing.md },
  introBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    marginHorizontal: Spacing.gutter, borderRadius: BorderRadius.md, padding: Spacing.md,
  },
  introIcon: { marginTop: 1 },
  introText: { flex: 1, fontSize: FontSize.sm, lineHeight: 18, fontFamily: UIFontLight },
  lockedRow: { position: 'relative', opacity: 0.55 },
  lockedRowContent: { flex: 1 },
  lockBadge: {
    position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
});
