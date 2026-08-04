import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { TitleFont, UIFont, UIFontLight, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { isLeft } from '@/core/utils/either';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { Card } from '@/components/ui/Card';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Icon } from '@/components/ui/Icon';
import QuestsView from './QuestsView';

export default function LeaderboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [checkinCounts, setCheckinCounts] = useState<Record<string, number>>({});
  const [uniScores, setUniScores] = useState<Record<string, number>>({});
  const user = useAuthStore((s) => s.user);
  const { language } = useLanguageStore();
  const t = useTranslation();
  const [attendeeProfiles, setAttendeeProfiles] = useState<Record<string, UserProfile>>({});
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    // Deliberately a separate fetch from the shared feed store — that one
    // (getFeedEvents) only ever holds upcoming events, which meant this
    // screen's "last 7 days" window was almost always empty for anything
    // that had already happened. Local-only state so it doesn't clobber the
    // feed's upcoming-only data for other screens.
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
    eventsRepository.getEventsSince(weekAgo).then(async (r) => {
      if (isLeft(r)) return;
      const events = r.right;

      // Ranks by who actually showed up, not who merely RSVP'd — matches
      // the app's real north-star metric (meetups, not intent-to-meetup).
      // attendeeIds would count a flaked RSVP the same as a real check-in.
      const perEvent = await Promise.all(events.map(async (e) => {
        const snap = await getDocs(collection(db, 'events', e.id, 'checkIns'));
        return { event: e, checkedInUids: snap.docs.map((d) => d.id) };
      }));
      const counts: Record<string, number> = {};
      const scores: Record<string, number> = {};
      for (const { event, checkedInUids } of perEvent) {
        for (const uid of checkedInUids) counts[uid] = (counts[uid] ?? 0) + 1;
        const uni = event.creatorUniversity || (event.allowedUniversities?.length && !event.allowedUniversities.includes('Any') ? event.allowedUniversities[0] : null);
        if (uni) scores[uni] = (scores[uni] ?? 0) + checkedInUids.length;
      }
      setCheckinCounts(counts);
      setUniScores(scores);
    });
  }, []);

  const uniLeaderboard = useMemo(
    () => Object.entries(uniScores).sort((a, b) => b[1] - a[1]),
    [uniScores],
  );

  // Tier-2 research finding: a single ranking motivates the top few percent
  // and quietly demoralises everyone else (Strava's insight — globally
  // average riders can be the fastest on one specific local climb). Rather
  // than blending scopes into one ambiguous list (which read as the same
  // person showing up twice with no explanation), this screen shows two
  // clearly separate, clearly labelled leaderboards: a small "your
  // university" one, and the full nationwide one below it — appearing in
  // both is expected, since they're different scopes, not a duplicate.
  const allRanking = useMemo(
    () => Object.entries(checkinCounts).sort((a, b) => b[1] - a[1]).map(([uid, count]) => ({ uid, count })),
    [checkinCounts],
  );
  // "All of Greece" — deliberately unscoped.
  const studentRanking = allRanking;

  // Scoped by universityName only — that field is a fixed chip picked at
  // signup (GREEK_UNIVERSITIES), so it matches exactly across accounts.
  // department, by contrast, is a free-text Input with no canonicalisation
  // ("Στατιστική" vs "Στατιστικής" vs "Stats" never match each other), which
  // is why this was switched from a department scope to a university one —
  // everyone who picked the same university chip at signup automatically
  // qualifies here, with no risk of a real classmate silently not matching.
  // Unsliced here — the collapsed picker card only shows the top 3, but the
  // expanded full view (scopeView === 'university') needs up to 10.
  const universityRanking = useMemo(() => {
    if (!user?.universityName) return [];
    return allRanking.filter((s) => attendeeProfiles[s.uid]?.university === user.universityName);
  }, [allRanking, attendeeProfiles, user?.universityName]);
  const hasUniRanking = universityRanking.length > 0;

  // Which of the two scopes (university / all of Greece) is currently
  // expanded to a full top-10 view. null = the two-card picker with 3-student
  // previews.
  const [scopeView, setScopeView] = useState<'university' | 'greece' | null>(null);
  const activeRanking = scopeView === 'university' ? universityRanking : studentRanking;

  const topStudents = studentRanking.slice(0, 8);

  // Fetches every candidate, not just the visible top 8 — the university/
  // department scoping above needs to know each candidate's affiliation
  // before it can filter the ranking down, not just after.
  useEffect(() => {
    const uids = Object.keys(checkinCounts);
    if (!uids.length) return;
    setLoadingProfiles(true);
    fetchUserProfiles(uids).then((p) => { setAttendeeProfiles(p); setLoadingProfiles(false); });
  }, [Object.keys(checkinCounts).join(',')]);

  const myUniIndex = user?.universityName ? uniLeaderboard.findIndex(([uni]) => uni === user.universityName) : -1;
  const myUniScore = myUniIndex >= 0 ? uniLeaderboard[myUniIndex][1] : 0;
  const leaderUniScore = uniLeaderboard[0]?.[1] ?? 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.head, { paddingTop: insets.top + 14 }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.leaderboardTitle}</Text>
        <Text style={[styles.subtitle, { color: colors.textHint }]}>
          {tab === 1 ? t.leaderboardSubtitleUniversities : t.leaderboardSubtitleStudents}
        </Text>
      </View>
      <SegmentedTabs
        tabs={[t.leaderboardTopStudents, t.leaderboardUniversities, t.leaderboardQuests]}
        activeIndex={tab}
        onChange={(i) => { setTab(i); setScopeView(null); }}
        style={styles.tabs}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 0 ? (
          loadingProfiles && topStudents.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : topStudents.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textHint }]}>{t.leaderboardEmpty}</Text>
          ) : scopeView === null ? (
            <>
              <View style={styles.scopeRow}>
                <AnimatedPressable
                  onPress={() => hasUniRanking && setScopeView('university')}
                  style={[styles.scopeCard, { backgroundColor: colors.surface, borderColor: colors.border }, !hasUniRanking && styles.scopeCardDisabled]}
                >
                  <Text style={[styles.scopeCardLabel, { color: colors.textPrimary }]} numberOfLines={2}>
                    {t.leaderboardYourUniversityScope(user?.universityName ? universityLabel(user.universityName, language) : '')}
                  </Text>
                  {hasUniRanking ? universityRanking.slice(0, 3).map(({ uid, count }, i) => (
                    <PreviewRow key={uid} rank={i + 1} profile={attendeeProfiles[uid]} score={count} isMe={uid === user?.id} />
                  )) : (
                    <Text style={[styles.scopeCardHint, { color: colors.textHint }]}>{t.leaderboardNoUniData}</Text>
                  )}
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => setScopeView('greece')}
                  style={[styles.scopeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.scopeCardLabel, { color: colors.textPrimary }]} numberOfLines={2}>{t.leaderboardAllGreece}</Text>
                  {studentRanking.slice(0, 3).map(({ uid, count }, i) => (
                    <PreviewRow key={uid} rank={i + 1} profile={attendeeProfiles[uid]} score={count} isMe={uid === user?.id} />
                  ))}
                </AnimatedPressable>
              </View>
              <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
                <Icon name="zap" size={15} color={colors.accentInk} />
                <Text style={[styles.noteText, { color: colors.accentInk }]}>{t.leaderboardXpNote}</Text>
              </View>
              <Text style={[styles.explainer, { color: colors.textHint }]}>{t.leaderboardExplainerStudents}</Text>
            </>
          ) : (
            <>
              <AnimatedPressable onPress={() => setScopeView(null)} style={styles.backRow}>
                <Icon name="back" size={16} color={colors.textPrimary} />
                <Text style={[styles.backRowLabel, { color: colors.textPrimary }]}>
                  {scopeView === 'university'
                    ? t.leaderboardYourUniversityScope(user?.universityName ? universityLabel(user.universityName, language) : '')
                    : t.leaderboardAllGreece}
                </Text>
              </AnimatedPressable>
              <RankedList
                ranking={activeRanking}
                cap={10}
                user={user}
                attendeeProfiles={attendeeProfiles}
                router={router}
                t={t}
              />
              <Text style={[styles.explainer, { color: colors.textHint }]}>{t.leaderboardExplainerStudents}</Text>
            </>
          )
        ) : tab === 2 ? (
          <QuestsView />
        ) : uniLeaderboard.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textHint }]}>{t.leaderboardEmpty}</Text>
        ) : (
          <>
            {myUniIndex >= 0 && (
              <Card padded style={styles.heroCard}>
                <SectionLabel label={t.leaderboardYourSchool} />
                <View style={styles.heroRow}>
                  <Text style={[styles.heroUni, { color: colors.textPrimary }]}>{universityLabel(user!.universityName!, language)}</Text>
                  <Text style={[styles.heroRank, { color: colors.primary }]}>{myUniIndex + 1}η</Text>
                </View>
                <ProgressTrack progress={myUniScore / leaderUniScore} style={{ marginTop: 10, marginBottom: 6 }} />
                <Text style={[styles.heroMeta, { color: colors.textHint }]}>
                  {t.leaderboardMeetups(myUniScore)}
                  {myUniIndex === 0
                    ? ` · ${t.leaderboardLeadingUni}`
                    : ` · ${t.leaderboardBehindLeader(leaderUniScore - myUniScore, universityLabel(uniLeaderboard[0][0], language))}`}
                </Text>
              </Card>
            )}
            <Card style={styles.card}>
              {uniLeaderboard.map(([uni, score], i) => (
                <UniRow
                  key={uni}
                  rank={i + 1}
                  name={universityLabel(uni, language)}
                  score={score}
                  isMe={uni === user?.universityName}
                  isLast={i === uniLeaderboard.length - 1}
                />
              ))}
            </Card>
            <Text style={[styles.explainer, { color: colors.textHint }]}>{t.leaderboardExplainerUniversities}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StudentRow({
  rank, profile, score, isMe, isLast, bare, subtitle, onPress,
}: {
  rank: number; profile?: UserProfile; score: number; isMe?: boolean; isLast?: boolean; bare?: boolean;
  /** Mockup 23's "Εσύ" row: "40 XP από την 3η θέση" — accent-ink gap-to-above-rank line. */
  subtitle?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const name = profile?.name ?? '…';
  const initial = (name[0] ?? '?').toUpperCase();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.row, !bare && !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
    >
      <Text style={[styles.rank, { color: isMe ? colors.accentInk : rank === 1 ? colors.primary : colors.textHint }]}>{rank}</Text>
      <View style={[styles.avatar, { backgroundColor: isMe ? colors.primary : profile?.avatarColor ?? colors.surfaceVariant }]}>
        {profile?.photoUri
          ? <Image source={{ uri: profile.photoUri }} style={styles.avatarImg} />
          : <Text style={[styles.avatarText, isMe && { color: '#fff' }]}>{initial}</Text>}
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>{isMe ? 'Εσύ' : name}</Text>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: colors.accentInk }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.rowScore, { color: colors.textPrimary }]}>{score}</Text>
    </AnimatedPressable>
  );
}

// Shared "top N, with your own row pulled out into its own accent card"
// layout (mockup 23) — used for both expanded scopes (class / all of
// Greece) so the split-around-you logic only lives in one place.
function RankedList({
  ranking, cap, user, attendeeProfiles, router, t,
}: {
  ranking: { uid: string; count: number }[];
  cap: number;
  user: ReturnType<typeof useAuthStore.getState>['user'];
  attendeeProfiles: Record<string, UserProfile>;
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslation>;
}) {
  const { colors } = useTheme();
  const top = ranking.slice(0, cap);
  const myRank = user ? ranking.findIndex((s) => s.uid === user.id) : -1;
  const myIndexInTop = top.findIndex((s) => s.uid === user?.id);
  const myInTop = myIndexInTop >= 0;
  const above = myInTop ? top.slice(0, myIndexInTop) : top;
  const below = myInTop ? top.slice(myIndexInTop + 1) : [];
  const rankGapAbove = myRank > 0 ? ranking[myRank - 1].count - ranking[myRank].count : 0;

  return (
    <>
      {above.length > 0 && (
        <Card style={styles.card}>
          {above.map(({ uid, count }, i) => (
            <StudentRow
              key={uid}
              rank={i + 1}
              profile={attendeeProfiles[uid]}
              score={count}
              isMe={uid === user?.id}
              isLast={i === above.length - 1}
              onPress={() => router.push(`/(app)/user/${uid}` as any)}
            />
          ))}
        </Card>
      )}
      {myRank >= 0 && (
        <Card style={[styles.meCard, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
          <StudentRow
            rank={myRank + 1}
            profile={attendeeProfiles[user!.id]}
            score={ranking[myRank].count}
            subtitle={myRank > 0 ? t.leaderboardRankGap(rankGapAbove, myRank) : undefined}
            isMe
            isLast
            bare
            onPress={() => {}}
          />
        </Card>
      )}
      {below.length > 0 && (
        <Card style={styles.card}>
          {below.map(({ uid, count }, i) => (
            <StudentRow
              key={uid}
              rank={myIndexInTop + 2 + i}
              profile={attendeeProfiles[uid]}
              score={count}
              isMe={uid === user?.id}
              isLast={i === below.length - 1}
              onPress={() => router.push(`/(app)/user/${uid}` as any)}
            />
          ))}
        </Card>
      )}
    </>
  );
}

// Compact, non-pressable row used only inside the two picker cards (the
// card itself is the tap target, expanding into the full RankedList).
function PreviewRow({
  rank, profile, score, isMe,
}: { rank: number; profile?: UserProfile; score: number; isMe?: boolean }) {
  const { colors } = useTheme();
  const name = profile?.name ?? '…';
  const initial = (name[0] ?? '?').toUpperCase();
  return (
    <View style={styles.previewRow}>
      <Text style={[styles.previewRank, { color: isMe ? colors.primary : colors.textHint }]}>{rank}</Text>
      <View style={[styles.previewAvatar, { backgroundColor: isMe ? colors.primary : profile?.avatarColor ?? colors.surfaceVariant }]}>
        {profile?.photoUri
          ? <Image source={{ uri: profile.photoUri }} style={styles.previewAvatarImg} />
          : <Text style={[styles.previewAvatarText, isMe && { color: '#fff' }]}>{initial}</Text>}
      </View>
      <Text style={[styles.previewName, { color: colors.textPrimary }]} numberOfLines={1}>{isMe ? 'Εσύ' : name}</Text>
      <Text style={[styles.previewScore, { color: colors.textHint }]}>{score}</Text>
    </View>
  );
}

function UniRow({
  rank, name, score, isMe, isLast,
}: { rank: number; name: string; score: number; isMe?: boolean; isLast?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[
      styles.row,
      !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      isMe && { backgroundColor: colors.accentSoft, marginHorizontal: -12, paddingHorizontal: 12 },
    ]}>
      <Text style={[styles.rank, { color: isMe ? colors.accentInk : rank === 1 ? colors.primary : colors.textHint }]}>{rank}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: isMe ? colors.accentInk : colors.textPrimary }]} numberOfLines={1}>{name}</Text>
      </View>
      <Text style={[styles.rowScore, { color: isMe ? colors.accentInk : colors.textPrimary }]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: Spacing.gutter, paddingBottom: 6 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.4 },
  subtitle: { fontSize: FontSize.md, fontFamily: UIFontLight, marginTop: 3 },
  tabs: { paddingHorizontal: Spacing.gutter },
  scroll: { flex: 1 },
  empty: { fontSize: FontSize.base, textAlign: 'center', marginTop: 40 },
  card: { marginHorizontal: Spacing.gutter, marginTop: Spacing.base, paddingHorizontal: 4 },
  deptLabel: { marginHorizontal: Spacing.gutter, marginTop: Spacing.base },
  scopeRow: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.gutter, marginTop: Spacing.base, alignItems: 'stretch' },
  scopeCard: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.sm, gap: 6 },
  scopeCardDisabled: { opacity: 0.5 },
  scopeCardLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont, marginBottom: 2 },
  scopeCardHint: { fontSize: 11, fontFamily: UIFontLight, paddingVertical: 6 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.gutter, marginTop: Spacing.base, paddingVertical: 4 },
  backRowLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  previewRank: { width: 14, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: UIFont, textAlign: 'center' },
  previewAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewAvatarImg: { width: 22, height: 22, borderRadius: 11 },
  previewAvatarText: { fontSize: 9.5, fontWeight: FontWeight.bold, fontFamily: UIFont, color: '#3A2E22' },
  previewName: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: FontWeight.medium, fontFamily: UIFont },
  previewScore: { fontSize: 11, fontWeight: FontWeight.bold, fontFamily: UIFont },
  meCard: { marginHorizontal: Spacing.gutter, marginTop: 10, paddingHorizontal: 16, borderRadius: BorderRadius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8 },
  rank: { width: 20, fontFamily: TitleFont, fontWeight: FontWeight.bold, fontSize: FontSize.lg, textAlign: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 34, height: 34, borderRadius: 17 },
  avatarText: { fontSize: 12.5, fontWeight: FontWeight.bold, fontFamily: UIFont, color: '#3A2E22' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  rowSubtitle: { fontSize: 11.5, fontFamily: UIFontLight, marginTop: 1 },
  rowScore: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  heroCard: { marginHorizontal: Spacing.gutter, marginTop: Spacing.base },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 7 },
  heroUni: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont, flexShrink: 1 },
  heroRank: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  heroMeta: { fontSize: FontSize.md, fontFamily: UIFontLight },
  note: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderRadius: BorderRadius.md, padding: 11, marginHorizontal: Spacing.gutter, marginTop: 13 },
  noteText: { flex: 1, fontSize: 11.5, fontFamily: UIFontLight, lineHeight: 17 },
  explainer: { fontSize: 12, fontFamily: UIFontLight, lineHeight: 17, textAlign: 'center', paddingHorizontal: Spacing.gutter, marginTop: 14 },
});
