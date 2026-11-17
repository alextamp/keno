import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarPile } from '@/components/ui/AvatarPile';
import { Card } from '@/components/ui/Card';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { KfgHeader } from '@/components/kfg/KfgHeader';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { daysUntilMonthlyReset, getKfgMonthId, KFG_LIMITS } from '@/core/constants/kfg';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { getISOWeekId } from '@/core/utils/weekId';
import { isLeft } from '@/core/utils/either';
import { fetchUserProfiles } from '@/core/utils/userProfiles';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { FEATURES } from '@/core/constants/features';
import { KfgLeaderboard, KfgLeaderboardEntry } from '@/features/kfg/domain/entities/kfg.entity';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { formatPoints } from '@/features/kfg/format';

type Row = { key: string; rank: number; name: string; sub?: string; points: number; avatar?: KfgLeaderboardEntry; me: boolean; prize?: boolean };

export default function KfgLeaderboardTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const profile = useKfgStore((s) => s.profile);
  const [tab, setTab] = useState(0);
  const [board, setBoard] = useState<KfgLeaderboard | null | undefined>(undefined);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [friends, setFriends] = useState<KfgLeaderboardEntry[] | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    kfgRepository.getLeaderboard(getKfgMonthId(now)).then((r) => setBoard(isLeft(r) ? null : r.right));
  }, [now]);

  const monthPoints = profile?.monthPoints ?? 0;
  useEffect(() => {
    kfgRepository.getMyRank(monthPoints).then((r) => setMyRank(isLeft(r) ? null : r.right));
  }, [monthPoints]);

  const following = user?.following.join(',') ?? '';
  useEffect(() => {
    if (tab !== 2 || friends !== null) return;
    const uids = following ? following.split(',') : [];
    (async () => {
      const [p, names] = await Promise.all([kfgRepository.getProfiles(uids), fetchUserProfiles(uids)]);
      const list = isLeft(p) ? [] : p.right;
      setFriends(list.filter((f) => f.monthPoints > 0).map((f) => ({
        uid: f.uid, points: f.monthPoints, name: names[f.uid]?.name ?? '',
        avatarColor: names[f.uid]?.avatarColor, photoUri: names[f.uid]?.photoUri, university: f.university,
      })));
    })();
  }, [tab, following, friends]);

  const rows: Row[] | null = useMemo(() => {
    if (tab === 1) {
      if (!board) return board === null ? [] : null;
      return board.universities.map((u, i) => ({
        key: u.name, rank: i + 1, name: universityLabel(u.name, language), points: u.points, me: u.name === user?.universityName,
      }));
    }
    const source = tab === 0 ? board?.top : friends ?? undefined;
    if (!source) return tab === 0 && board === null ? [] : null;
    const withMe = tab === 2 && user && monthPoints > 0
      ? [...source, { uid: user.id, name: user.name, points: monthPoints, avatarColor: user.avatarColor, photoUri: user.photoUri }]
      : source;
    return [...withMe].sort((a, b) => b.points - a.points).slice(0, 20).map((e, i) => ({
      key: e.uid, rank: i + 1, prize: FEATURES.kfgPrizes && (board?.prizeWinnerUids ?? []).includes(e.uid), name: e.name, sub: e.university ? universityLabel(e.university, language) : undefined,
      points: e.points, avatar: e, me: e.uid === user?.id,
    }));
  }, [tab, board, friends, user?.id, monthPoints, language]);

  const delta = profile?.rankAtWeekStart && profile.rankWeekId === getISOWeekId(now) && myRank
    ? profile.rankAtWeekStart - myRank : null;
  const cutoff = board?.top[KFG_LIMITS.leaderboardTop - 1]?.points ?? 0;
  const inTop = myRank != null && myRank <= KFG_LIMITS.leaderboardTop;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]}
    >
      <KfgHeader balance={profile?.balance ?? 0} />
      <View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.kfgTabLeaderboard}</Text>
        <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgRankSubtitle(daysUntilMonthlyReset(now))}</Text>
      </View>

      <SegmentedTabs tabs={[t.kfgRankPeople, t.kfgRankSchools, t.kfgRankFriends]} activeIndex={tab} onChange={setTab} centered />

      {rows === null ? (
        <Card padded style={styles.skeletons}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={36} />)}</Card>
      ) : rows.length === 0 ? (
        <Card padded>
          <Text style={[styles.meta, styles.center, { color: colors.textHint }]}>{tab === 2 ? t.kfgFriendsEmpty : t.kfgRankEmpty}</Text>
        </Card>
      ) : (
        <Card style={styles.list}>
          {rows.map((r, i) => (
            <View
              key={r.key}
              accessible
              accessibilityLabel={`${r.rank}. ${r.name}, ${t.kfgPoints(formatPoints(r.points, language))}`}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <Text style={[styles.rank, { color: r.prize ? colors.accentInk : colors.textHint }]}>{r.prize ? '🏆' : r.rank}</Text>
              {r.avatar && (
                <AvatarPile profiles={[{ uid: r.avatar.uid, name: r.avatar.name, avatarColor: r.avatar.avatarColor, photoUri: r.avatar.photoUri }]} size={30} />
              )}
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{r.me ? `${r.name} · ${t.kfgYou}` : r.name}</Text>
                {!!r.sub && <Text style={[styles.sub, { color: colors.textHint }]} numberOfLines={1}>{r.sub}</Text>}
              </View>
              <Text style={[styles.points, { color: colors.textPrimary }]}>{formatPoints(r.points, language)}</Text>
            </View>
          ))}
        </Card>
      )}

      {tab !== 1 && (
        <Card padded style={[styles.mine, { borderColor: colors.primary }]}>
          {myRank ? (
            <>
              <Text style={[styles.mineLine, { color: colors.textPrimary }]}>
                {`${myRank} · ${t.kfgYou} · ${t.kfgPoints(formatPoints(monthPoints, language))}`}
              </Text>
              {delta != null && <Text style={[styles.sub, { color: colors.accentInk }]}>{t.kfgRankDelta(delta)}</Text>}
            </>
          ) : (
            <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgNoRankYet}</Text>
          )}
        </Card>
      )}

      {tab === 0 && myRank != null && (
        <View style={styles.towards}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t.kfgTowardsTop(KFG_LIMITS.leaderboardTop)}</Text>
          <ProgressTrack progress={inTop || cutoff === 0 ? 1 : monthPoints / cutoff} />
          <Text style={[styles.sub, { color: colors.textHint }]}>
            {inTop ? t.kfgInTop(KFG_LIMITS.leaderboardTop)
              : t.kfgPointsToTop(formatPoints(Math.max(1, cutoff - monthPoints + 1), language), KFG_LIMITS.leaderboardTop)}
          </Text>
        </View>
      )}

      {FEATURES.kfgPrizes && <Text style={[styles.rule, { color: colors.textHint }]}>{t.kfgPrizeRule(KFG_LIMITS.prizeWinners)}</Text>}
      <Text style={[styles.sub, styles.center, { color: colors.textDecor }]}>{t.kfgRankUpdated}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.md },
  title: { fontFamily: TitleFont, fontSize: FontSize.display, fontWeight: FontWeight.bold, letterSpacing: -0.5 },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19 },
  center: { textAlign: 'center' },
  skeletons: { gap: Spacing.md },
  list: { paddingHorizontal: Spacing.base },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingVertical: Spacing.sm },
  rank: { width: 26, fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  rowText: { flex: 1, gap: 1 },
  name: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  sub: { fontFamily: UIFontLight, fontSize: FontSize.sm },
  points: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  mine: { borderWidth: 1.5, borderRadius: BorderRadius.lg, gap: 3 },
  mineLine: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  towards: { gap: 6 },
  label: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  rule: { fontFamily: UIFontLight, fontSize: FontSize.sm, lineHeight: 18 },
});
