import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { KfgHeader } from '@/components/kfg/KfgHeader';
import { KfgLevelCard } from '@/components/kfg/KfgLevelCard';
import { KfgMissionRow } from '@/components/kfg/KfgMissionRow';
import { useTheme } from '@/core/theme';
import { FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useTranslation } from '@/core/i18n';
import { MyMissionRow } from '@/components/kfg/MyMissionRow';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { missionsThisWeek } from '@/features/kfg/missions';

export default function MissionsTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const router = useRouter();
  const { profile, missions, myMissions, participations, loaded } = useKfgStore();
  // Taken once per mount — only used to drop missions that ended over a week ago.
  const [now] = useState(Date.now);
  const mine = useMemo(
    () => myMissions.filter((m) => m.status === 'pending' || m.endsAt.getTime() > now - 7 * 86_400_000),
    [myMissions, now],
  );
  const list = useMemo(() => missionsThisWeek(missions, participations), [missions, participations]);
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

      <KfgLevelCard profile={profile} />

      <SectionLabel label={t.kfgThisWeek} style={styles.section} />
      {!loaded ? (
        <Card padded style={styles.skeletons}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={50} />)}
        </Card>
      ) : list.length === 0 ? (
        <Card padded style={styles.empty}>
          <Icon name="heart" size={26} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.kfgEmptyTitle}</Text>
          <Text style={[styles.emptyBody, { color: colors.textHint }]}>{t.kfgEmptyBody}</Text>
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
});
