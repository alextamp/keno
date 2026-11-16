import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { KfgCharacter } from '@/components/kfg/KfgCharacter';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { getCosmetic, KFG_CHARACTERS, KFG_LEVELS } from '@/core/constants/kfg';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { formatPoints, kfgLevelInfo } from '@/features/kfg/format';
import { buildKfgTickets, completedParticipations } from '@/features/kfg/tickets';
import { KfgTicket } from '@/components/kfg/KfgTicket';
import { analytics } from '@/core/utils/analytics';

export default function KfgCompleteScreen() {
  return (
    <AccentScopeProvider value="kfg">
      <CompleteInner />
    </AccentScopeProvider>
  );
}

function CompleteInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const participation = useKfgStore((s) => (id ? s.participationFor(id) : undefined));
  const { profile, ownedCosmetics, participations } = useKfgStore();
  const [mission, setMission] = useState<KfgMission | null>(null);
  const [doneMissions, setDoneMissions] = useState<KfgMission[]>([]);
  const ticketRef = useRef<React.ComponentRef<typeof View>>(null);

  // The ticket's serial counts every mission you've completed, so all of
  // them are needed, not just this one.
  const doneIds = completedParticipations(participations).map((p) => p.missionId).sort().join(',');
  useEffect(() => {
    if (!doneIds) return;
    kfgRepository.getMissions(doneIds.split(',')).then(setDoneMissions);
  }, [doneIds]);
  const ticket = useMemo(
    () => buildKfgTickets(participations, doneMissions).find((tk) => tk.mission.id === id),
    [participations, doneMissions, id],
  );

  useEffect(() => (id ? kfgRepository.subscribeMission(id, setMission) : undefined), [id]);

  // Check halo pops in (spec §5: 0.8 → 1 while the check draws).
  const halo = useSharedValue(0.8);
  const fade = useSharedValue(0);
  useEffect(() => {
    halo.value = withSpring(1, { damping: 12, stiffness: 220 });
    fade.value = withTiming(1, { duration: 300 });
    haptics.success();
  }, []);
  const haloStyle = useAnimatedStyle(() => ({ transform: [{ scale: halo.value }], opacity: fade.value }));

  if (!participation || !mission || !profile) return <LoadingScreen />;

  const award = participation.award;
  const levelNow = kfgLevelInfo(profile.lifetimePoints, language);
  const levelName = (n: number) => KFG_LEVELS[n - 1]?.name[language] ?? '';
  const leveledUp = !!award && award.levelAfter > award.levelBefore;
  const unlocked = (award?.unlocked ?? []).map(getCosmetic).filter((c): c is NonNullable<typeof c> => !!c);
  // Level-unlocked characters arrive in the same list as cosmetics.
  const unlockedChars = KFG_CHARACTERS.filter((c) => (award?.unlocked ?? []).includes(c.id));
  const when = participation.checkOutAt ?? new Date();

  const shareTicket = async () => {
    if (!ticketRef.current) return;
    haptics.light();
    try {
      const uri = await captureRef(ticketRef, { format: 'png', quality: 0.95 });
      const result = await Share.share({ url: uri, title: mission.title, message: `💚 ${mission.title} — Keno for Good` });
      if (result.action !== 'dismissedAction') analytics.track('kfg_ticket_shared', { missionId: mission.id });
    } catch {}
  };

  const wear = async (itemId: string, slot: 'head' | 'face' | 'neck') => {
    const r = await kfgRepository.equip(profile.uid, { ...profile.equipped, [slot]: itemId });
    if (isLeft(r)) Alert.alert(t.kfgUnlocked, t.kfgError(r.left.message));
    else haptics.success();
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
    >
      <Animated.View style={[styles.halo, { backgroundColor: colors.accentSoft }, haloStyle]}>
        <Icon name="check" size={32} color={colors.primary} strokeWidth={2.2} />
      </Animated.View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t.kfgWellDone}</Text>
      <Text style={[styles.sub, { color: colors.textHint }]}>{`${mission.creatorName} · ${format(when, 'HH:mm')}`}</Text>

      {participation.status === 'completed' && award ? (
        <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.pillText, { color: colors.accentInk }]}>
            {t.kfgAwardPill(formatPoints(award.points, language), award.countsForLeaderboard)}
          </Text>
        </View>
      ) : (
        <Text style={[styles.note, { color: colors.textHint }]}>
          {participation.status === 'inReview' ? t.kfgPhotosInReview : t.kfgPendingPayout}
        </Text>
      )}

      {ticket && (
        <View ref={ticketRef} collapsable={false} style={[styles.ticketWrap, { backgroundColor: colors.background }]}>
          <KfgTicket ticket={ticket} />
        </View>
      )}

      <Card padded style={styles.levelCard}>
        <Text style={[styles.levelName, { color: colors.textPrimary }]}>
          {leveledUp ? t.kfgLevelUp(levelName(award!.levelBefore), levelName(award!.levelAfter)) : levelNow.label}
        </Text>
        <ProgressTrack progress={levelNow.progress} />
        <Text style={[styles.note, { color: colors.textHint }]}>
          {levelNow.next ? t.kfgPointsToLevel(formatPoints(levelNow.pointsToNext, language), levelNow.next.level) : t.kfgMaxLevel}
        </Text>
      </Card>

      {unlocked.map((item) => {
        const wearing = profile.equipped[item.slot] === item.id;
        return (
          <View key={item.id} style={styles.unlockWrap}>
            <SectionLabel label={t.kfgUnlocked} />
            <Card padded style={styles.unlockCard}>
              <View style={[styles.unlockThumb, { backgroundColor: colors.accentSoft }]}>
                <KfgCharacter size={72} equipped={{ ...profile.equipped, [item.slot]: item.id }} character={profile.character} />
              </View>
              <Text style={[styles.unlockName, { color: colors.textPrimary }]}>{item.name[language]}</Text>
              {ownedCosmetics.includes(item.id) && (
                <Button label={wearing ? t.kfgWearing : t.kfgWearIt} onPress={() => wear(item.id, item.slot)} disabled={wearing} size="sm" />
              )}
            </Card>
          </View>
        );
      })}

      {unlockedChars.map((c) => {
        const using = profile.character === c.id;
        return (
          <View key={c.id} style={styles.unlockWrap}>
            <SectionLabel label={t.kfgUnlocked} />
            <Card padded style={styles.unlockCard}>
              <View style={[styles.unlockThumb, { backgroundColor: colors.accentSoft }]}>
                <KfgCharacter size={72} equipped={profile.equipped} character={c.id} />
              </View>
              <Text style={[styles.unlockName, { color: colors.textPrimary }]}>{c.name[language]}</Text>
              <Button
                label={using ? t.kfgWearing : t.kfgWearIt}
                onPress={async () => {
                  const r = await kfgRepository.setCharacter(profile.uid, c.id);
                  if (isLeft(r)) Alert.alert(t.kfgUnlocked, t.kfgError(r.left.message));
                  else haptics.success();
                }}
                disabled={using}
                size="sm"
              />
            </Card>
          </View>
        );
      })}

      <View style={styles.actions}>
        {ticket && <Button label={t.kfgShareStory} variant="outline" onPress={shareTicket} fullWidth />}
        <Button label={t.kfgBackToMissions} variant="ghost" onPress={() => router.dismissTo('/(app)/kfg' as any)} fullWidth />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, alignItems: 'center', gap: Spacing.md },
  halo: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: TitleFont, fontSize: FontSize.display, fontWeight: FontWeight.bold, letterSpacing: -0.5 },
  sub: { fontFamily: UIFontLight, fontSize: FontSize.md, marginTop: -6 },
  pill: { borderRadius: BorderRadius.full, paddingHorizontal: 14, paddingVertical: 7 },
  pillText: { fontFamily: UIFont, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  note: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19, textAlign: 'center' },
  levelCard: { alignSelf: 'stretch', gap: Spacing.sm },
  ticketWrap: { alignSelf: 'stretch', padding: 4 },
  levelName: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  unlockWrap: { alignSelf: 'stretch', gap: Spacing.sm },
  unlockCard: { alignItems: 'center', gap: Spacing.sm },
  unlockThumb: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  unlockName: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  actions: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.sm },
});
