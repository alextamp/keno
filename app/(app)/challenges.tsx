import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ChallengeRow } from '@/components/ui/ChallengeRow';
import { Spacing } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useTheme } from '@/core/theme';
import { useTranslation } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { getChallengeDefs } from '@/core/constants/challenges';
import QuestsView from '@/screens/QuestsView';

// Weekly quests (used to live as their own Leaderboard tab, which didn't
// really fit next to rankings) and lifetime challenges (previously capped
// to a few rows on Profile) are the same idea at different timescales — one
// "Αποστολές" page now covers both, reached from Profile's Challenges card.
export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const challenges = getChallengeDefs(user, t);
  const claimOrder = user?.claimedChallengeIds ?? [];
  const activeChallenges = challenges.filter((c) => c.current < c.target);
  const doneChallenges = challenges
    .filter((c) => c.current >= c.target)
    .sort((a, b) => claimOrder.indexOf(a.id) - claimOrder.indexOf(b.id));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: Spacing.gutter, paddingTop: insets.top + 12 }}>
        <ScreenHeader title={t.profileChallengesTitle} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <QuestsView />

        <SectionLabel label={t.profileChallengesSectionLabel} style={styles.sectionLabel} />
        <View style={styles.list}>
          {[...activeChallenges, ...doneChallenges].map((c) => <ChallengeRow key={c.id} challenge={c} />)}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 4 },
  sectionLabel: { marginTop: 18, marginBottom: 9, marginHorizontal: Spacing.gutter },
  list: { paddingHorizontal: Spacing.gutter, gap: Spacing.md },
});
