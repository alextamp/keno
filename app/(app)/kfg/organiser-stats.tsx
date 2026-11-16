import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Icon } from '@/components/ui/Icon';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { getDateLocale, useLanguageStore, useTranslation } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { computeKfgOrganiserStats, KFG_ORG_STATS_MIN } from '@/features/kfg/organiserStats';

export default function KfgOrganiserStatsScreen() {
  return (
    <AccentScopeProvider value="kfg">
      <StatsInner />
    </AccentScopeProvider>
  );
}

// The events' organiser stats screen, for the missions you created (the
// creator's own missions come from the KfG store's myMissions).
function StatsInner() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const { myMissions, loaded, start, stop } = useKfgStore();
  const [now] = useState(Date.now);

  useEffect(() => {
    if (!user) return;
    start(user.id);
    return stop;
  }, [user?.id]);

  const stats = useMemo(() => computeKfgOrganiserStats(myMissions, now), [myMissions, now]);
  if (!loaded) return <LoadingScreen />;

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const maxJoined = Math.max(1, ...stats.recent.map((r) => r.joined));
  const enough = stats.finished >= KFG_ORG_STATS_MIN;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: Spacing.gutter, paddingTop: insets.top + 12 }}>
        <ScreenHeader title={t.orgStatsTitle} />
      </View>

      {!enough ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
            <Icon name="heart" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.orgStatsEmptyTitle}</Text>
          <Text style={[styles.empty, { color: colors.textHint }]}>{t.orgStatsEmptyBody(KFG_ORG_STATS_MIN - stats.finished)}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={[styles.sub, { color: colors.textHint }]}>{t.orgStatsSubtitle(stats.finished)}</Text>

          <View style={styles.tiles}>
            <Card padded style={styles.tile}>
              <Text style={[styles.big, { color: colors.textPrimary }]}>{pct(stats.attendanceRate)}</Text>
              <Text style={[styles.tileLabel, { color: colors.textHint }]}>{t.orgStatsAttendance}</Text>
            </Card>
            <Card padded style={styles.tile}>
              <Text style={[styles.big, { color: colors.textPrimary }]}>{pct(stats.noShowRate)}</Text>
              <Text style={[styles.tileLabel, { color: colors.textHint }]}>{t.orgStatsNoShow}</Text>
            </Card>
          </View>

          <Card padded>
            <SectionLabel label={t.orgStatsPerEvent} />
            <View style={styles.bars}>
              {stats.recent.map((r) => (
                <View key={r.missionId} style={styles.barRow}>
                  <View style={styles.barText}>
                    <Text style={[styles.barTitle, { color: colors.textPrimary }]} numberOfLines={1}>{r.title}</Text>
                    <Text style={[styles.barMeta, { color: colors.textHint }]}>
                      {format(r.startsAt, 'd MMM', { locale: getDateLocale(language) })} · {t.orgStatsCameOf(r.came, r.joined)}
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
                    <View style={[styles.trackJoined, { width: `${(r.joined / maxJoined) * 100}%`, backgroundColor: colors.accentSoft }]} />
                    <View style={[styles.trackCame, { width: `${(r.came / maxJoined) * 100}%`, backgroundColor: colors.primary }]} />
                  </View>
                </View>
              ))}
            </View>
          </Card>

          <View style={styles.tiles}>
            <Card padded style={styles.tile}>
              <Text style={[styles.big, { color: colors.textPrimary }]}>{stats.uniqueVolunteers}</Text>
              <Text style={[styles.tileLabel, { color: colors.textHint }]}>{t.orgStatsUnique}</Text>
            </Card>
            <Card padded style={styles.tile}>
              <Text style={[styles.big, { color: colors.textPrimary }]}>{stats.returningVolunteers}</Text>
              <Text style={[styles.tileLabel, { color: colors.textHint }]}>{t.orgStatsReturning}</Text>
            </Card>
          </View>

          <Card padded>
            <SectionLabel label={t.orgStatsFeedback} />
            <Text style={[styles.feedback, { color: colors.textPrimary }]}>
              {stats.positiveFeedback == null ? t.orgStatsNoFeedback : t.orgStatsPositive(pct(stats.positiveFeedback), stats.feedbackCount)}
            </Text>
            <Text style={[styles.note, { color: colors.textHint }]}>{t.orgStatsPrivacyNote}</Text>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.gutter, gap: Spacing.md },
  sub: { fontFamily: UIFontLight, fontSize: FontSize.sm },
  tiles: { flexDirection: 'row', gap: Spacing.md },
  tile: { flex: 1 },
  big: { fontFamily: TitleFont, fontSize: 30, fontWeight: FontWeight.bold },
  tileLabel: { fontFamily: UIFontLight, fontSize: FontSize.sm, marginTop: 2 },
  bars: { marginTop: Spacing.md, gap: Spacing.md },
  barRow: { gap: 6 },
  barText: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  barTitle: { flex: 1, fontFamily: UIFont, fontSize: FontSize.sm },
  barMeta: { fontFamily: UIFontLight, fontSize: FontSize.xs },
  track: { height: 10, borderRadius: BorderRadius.full, overflow: 'hidden' },
  trackJoined: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: BorderRadius.full },
  trackCame: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: BorderRadius.full },
  feedback: { fontFamily: UIFont, fontSize: FontSize.lg, marginTop: Spacing.sm },
  note: { fontFamily: UIFontLight, fontSize: FontSize.xs, marginTop: 6, lineHeight: 16 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: TitleFont, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, textAlign: 'center' },
  empty: { fontFamily: UIFontLight, fontSize: FontSize.base, textAlign: 'center', lineHeight: 21, paddingHorizontal: Spacing.lg },
});
