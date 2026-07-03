import React, { useEffect, useMemo, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { isLeft } from '@/core/utils/either';
import { useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const events = useEventsStore((s) => s.events);
  const setEvents = useEventsStore((s) => s.setEvents);
  const { language } = useLanguageStore();
  const [attendeeProfiles, setAttendeeProfiles] = useState<Record<string, UserProfile>>({});
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const bs = colors.borderStrong;

  useEffect(() => {
    if (events.length === 0) {
      eventsRepository.getFeedEvents().then((r) => { if (!isLeft(r)) setEvents(r.right); });
    }
  }, []);

  const uniLeaderboard = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
    const scores: Record<string, number> = {};
    for (const e of events) {
      if (e.dateTime < weekAgo) continue;
      const uni = e.creatorUniversity || (e.allowedUniversities?.length && !e.allowedUniversities.includes('Any') ? e.allowedUniversities[0] : null);
      if (!uni) continue;
      scores[uni] = (scores[uni] ?? 0) + e.attendeeIds.length;
    }
    return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  const topAttendees = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
    const counts: Record<string, number> = {};
    for (const e of events) {
      if (e.dateTime < weekAgo) continue;
      for (const uid of e.attendeeIds) counts[uid] = (counts[uid] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uid, count]) => ({ uid, count }));
  }, [events]);

  useEffect(() => {
    const uids = topAttendees.map((x) => x.uid);
    if (!uids.length) return;
    setLoadingProfiles(true);
    fetchUserProfiles(uids).then((p) => { setAttendeeProfiles(p); setLoadingProfiles(false); });
  }, [topAttendees.map((x) => x.uid).join(',')]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <ScreenHeader title="🏆 Leaderboard" />

      <Text style={[styles.subtitle, { color: colors.textHint }]}>Rankings reset every week</Text>

      {/* University rankings */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: bs }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>🎓 Universities</Text>
        {uniLeaderboard.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textHint }]}>No data yet this week</Text>
        ) : (
          uniLeaderboard.map(([uni, score], i) => (
            <View key={uni} style={[styles.row, i < uniLeaderboard.length - 1 && { borderBottomWidth: 1.5, borderBottomColor: colors.border }]}>
              <View style={[styles.medalWrap, { backgroundColor: i < 3 ? MEDAL_COLORS[i] + '22' : colors.surfaceVariant }]}>
                <Text style={styles.medal}>{i < 3 ? MEDALS[i] : `${i + 1}`}</Text>
              </View>
              <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>{uni}</Text>
              <Text style={[styles.rowScore, { color: colors.textHint }]}>{score} going</Text>
            </View>
          ))
        )}
      </View>

      {/* Top students */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: bs }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>⭐ Top Students</Text>
        {loadingProfiles ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: Spacing.md }} />
        ) : topAttendees.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textHint }]}>No data yet this week</Text>
        ) : (
          topAttendees.map(({ uid, count }, i) => {
            const profile = attendeeProfiles[uid];
            const name = profile?.name ?? '…';
            const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
            return (
              <AnimatedPressable
                key={uid}
                onPress={() => router.push(`/(app)/user/${uid}` as any)}
                style={[
                  styles.row,
                  i < topAttendees.length - 1 && { borderBottomWidth: 1.5, borderBottomColor: colors.border },
                ]}
              >
                <View style={[styles.medalWrap, { backgroundColor: i < 3 ? MEDAL_COLORS[i] + '22' : colors.surfaceVariant }]}>
                  <Text style={styles.medal}>{i < 3 ? MEDALS[i] : `${i + 1}`}</Text>
                </View>
                <View style={[styles.avatar, { backgroundColor: profile?.avatarColor ?? colors.primary }]}>
                  {profile?.photoUri
                    ? <Image source={{ uri: profile.photoUri }} style={styles.avatarImg} />
                    : <Text style={styles.avatarText}>{initials || '?'}</Text>
                  }
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
                  {!!profile?.university && (
                    <Text style={[styles.rowUni, { color: colors.textHint }]} numberOfLines={1}>{universityLabel(profile.university, language)}</Text>
                  )}
                </View>
                <Text style={[styles.rowScore, { color: colors.textHint }]}>{count} events</Text>
              </AnimatedPressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  subtitle: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, textAlign: 'center', marginTop: -8 },
  card: { borderWidth: 2.5, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadow.sm },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, padding: Spacing.md, paddingBottom: Spacing.sm },
  empty: { fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  medalWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  medal: { fontSize: 18 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.extrabold },
  rowBody: { flex: 1, gap: 1 },
  rowName: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, flex: 1 },
  rowUni: { fontSize: FontSize.xs },
  rowScore: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
