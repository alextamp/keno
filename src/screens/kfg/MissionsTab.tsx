import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { KfgHeader } from '@/components/kfg/KfgHeader';
import { KfgLevelCard } from '@/components/kfg/KfgLevelCard';
import { CAUSE_ICONS, KfgMissionRow } from '@/components/kfg/KfgMissionRow';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { KfgCause } from '@/features/kfg/domain/entities/kfg.entity';
import { BorderRadius } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import { FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useTranslation } from '@/core/i18n';
import { MyMissionRow } from '@/components/kfg/MyMissionRow';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { missionsThisWeek, withoutBlocked } from '@/features/kfg/missions';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';

export default function MissionsTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const router = useRouter();
  const { profile, missions: allMissions, myMissions, participations, loaded } = useKfgStore();
  const blocked = useAuthStore((s) => s.user?.blockedUserIds);
  const missions = useMemo(() => withoutBlocked(allMissions, blocked), [allMissions, blocked]);
  // Taken once per mount (render must stay pure).
  const [now] = useState(Date.now);
  const mine = useMemo(
    () => myMissions.filter((m) => m.status === 'pending' || m.endsAt.getTime() > now - 7 * 86_400_000),
    [myMissions, now],
  );
  // Same search + chips idea as the feed: typing or picking a cause searches
  // every upcoming mission, not just this week's.
  const [search, setSearch] = useState('');
  const [cause, setCause] = useState<KfgCause | null>(null);
  const q = search.trim().toLowerCase();
  const list = useMemo(() => {
    if (!q && !cause) return missionsThisWeek(missions, participations);
    return missions
      .filter((m) => m.endsAt.getTime() > now)
      .filter((m) => !cause || m.cause === cause)
      .filter((m) => !q || [m.title, m.description, m.areaLabel, m.creatorName, m.groupName ?? '']
        .some((x) => x.toLowerCase().includes(q)));
  }, [missions, participations, q, cause, now]);
  // Admin-pinned flagship (like the events' flagship banner).
  const flagship = useMemo(() => missions.find((m) => m.isFlagship && m.endsAt.getTime() > now), [missions, now]);
  const joinedIds = useMemo(
    () => new Set(participations.filter((p) => p.status !== 'cancelled').map((p) => p.missionId)),
    [participations],
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]}
    >
      <KfgHeader balance={profile?.balance ?? 0} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t.kfgMissionsTitle}</Text>

      {flagship && (
        <AnimatedPressable onPress={() => router.push(`/(app)/kfg/mission/${flagship.id}` as any)} accessibilityRole="button">
          <Card style={styles.flagship}>
            {flagship.imageUri
              ? <Image source={{ uri: flagship.imageUri }} style={styles.flagshipImg} />
              : <View style={[styles.flagshipImg, styles.flagshipIcon, { backgroundColor: colors.accentSoft }]}>
                  <Icon name={CAUSE_ICONS[flagship.cause]} size={40} color={colors.primary} />
                </View>}
            <View style={styles.flagshipBody}>
              <Text style={[styles.flagshipKicker, { color: colors.accentInk }]}>📌 KENO FOR GOOD</Text>
              <Text style={[styles.flagshipTitle, { color: colors.textPrimary }]} numberOfLines={2}>{flagship.title}</Text>
              <Text style={[styles.emptyBody, { color: colors.textHint, textAlign: 'left' }]} numberOfLines={1}>
                {`${flagship.creatorName} · ${flagship.areaLabel}`}
              </Text>
            </View>
          </Card>
        </AnimatedPressable>
      )}

      <KfgLevelCard profile={profile} />

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="search" size={16} color={colors.textHint} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder={t.kfgSearchPlaceholder}
          placeholderTextColor={colors.textHint}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <AnimatedPressable onPress={() => setSearch('')} hitSlop={8}>
            <Icon name="x" size={15} color={colors.textHint} />
          </AnimatedPressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {([null, 'food', 'animals', 'environment', 'recycling', 'people', 'other'] as (KfgCause | null)[]).map((c) => {
          const on = cause === c;
          return (
            <AnimatedPressable
              key={c ?? 'all'}
              onPress={() => setCause(c)}
              style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface }]}
            >
              {c && <Icon name={CAUSE_ICONS[c]} size={13} color={on ? colors.accentInk : colors.textSecondary} />}
              <Text style={[styles.chipText, { color: on ? colors.accentInk : colors.textSecondary }]}>{c ? t.kfgCause(c) : t.kfgAllCauses}</Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      <SectionLabel label={q || cause ? t.kfgMissionsCount(list.length) : t.kfgThisWeek} style={styles.section} />
      {!loaded ? (
        <Card padded style={styles.skeletons}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={50} />)}
        </Card>
      ) : list.length === 0 ? (
        <Card padded style={styles.empty}>
          <Icon name="heart" size={26} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{q || cause ? t.kfgNoResults : t.kfgEmptyTitle}</Text>
          {!q && !cause && <Text style={[styles.emptyBody, { color: colors.textHint }]}>{t.kfgEmptyBody}</Text>}
        </Card>
      ) : (
        <Card style={styles.list}>
          {list.map((m, i) => (
            <KfgMissionRow
              key={m.id}
              mission={m}
              joined={joinedIds.has(m.id)}
              first={i === 0}
              onPress={() => router.push(`/(app)/kfg/mission/${m.id}` as any)}
            />
          ))}
        </Card>
      )}

      {mine.length > 0 && (
        <>
          <SectionLabel label={t.kfgMyMissions} style={styles.section} />
          <Card style={styles.list}>
            {mine.map((m, i) => (
              <MyMissionRow
                key={m.id}
                mission={m}
                over={m.endsAt.getTime() <= now}
                first={i === 0}
                onPress={() => router.push(`/(app)/kfg/mission/${m.id}` as any)}
              />
            ))}
          </Card>
          <AnimatedPressable onPress={() => router.push('/(app)/kfg/organiser-stats' as any)}>
            <Card padded style={styles.statsRow}>
              <Icon name="trophy" size={18} color={colors.primary} />
              <Text style={[styles.statsText, { color: colors.textPrimary }]}>{t.orgStatsTitle}</Text>
              <Icon name="fwd" size={15} color={colors.textDecor} />
            </Card>
          </AnimatedPressable>
        </>
      )}

      <View style={styles.newWrap}>
        <Button label={t.kfgNewMission} variant="outline" onPress={() => router.push('/(app)/kfg/create' as any)} fullWidth />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.md },
  title: { fontFamily: TitleFont, fontSize: FontSize.display, fontWeight: FontWeight.bold, letterSpacing: -0.5, marginBottom: 2 },
  section: { marginTop: Spacing.sm },
  list: { paddingHorizontal: Spacing.base },
  skeletons: { gap: Spacing.md },
  empty: { alignItems: 'center', gap: 6, paddingVertical: Spacing.lg },
  emptyTitle: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  emptyBody: { fontFamily: UIFontLight, fontSize: FontSize.md, textAlign: 'center' },
  newWrap: { marginTop: Spacing.sm },
  flagship: { overflow: 'hidden' },
  flagshipImg: { width: '100%', height: 130 },
  flagshipIcon: { alignItems: 'center', justifyContent: 'center' },
  flagshipBody: { padding: Spacing.md, gap: 2 },
  flagshipKicker: { fontFamily: UIFont, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1.2 },
  flagshipTitle: { fontFamily: TitleFont, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statsText: { flex: 1, fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 14, height: 42 },
  searchInput: { flex: 1, fontFamily: UIFont, fontSize: FontSize.md },
  chips: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 12, height: 34 },
  chipText: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
