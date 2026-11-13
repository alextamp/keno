import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { AvatarPile, PileProfile } from '@/components/ui/AvatarPile';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { InfoRow } from '@/components/ui/InfoRow';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { CAUSE_ICONS } from '@/components/kfg/KfgMissionRow';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { KFG_LIMITS } from '@/core/constants/kfg';
import { getDateLocale, useLanguageStore, useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { analytics } from '@/core/utils/analytics';
import { haversineKm } from '@/core/utils/geo';
import { fetchUserProfiles } from '@/core/utils/userProfiles';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { formatPoints } from '@/features/kfg/format';

export default function KfgMissionScreen() {
  return (
    <AccentScopeProvider value="kfg">
      <MissionInner />
    </AccentScopeProvider>
  );
}

function MissionInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const participation = useKfgStore((s) => (id ? s.participationFor(id) : undefined));
  const [mission, setMission] = useState<KfgMission | null | undefined>(undefined);
  const [people, setPeople] = useState<PileProfile[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Taken once per visit: whether it's started/over only matters at a coarse grain here.
  const [now] = useState(Date.now);

  useEffect(() => (id ? kfgRepository.subscribeMission(id, setMission) : undefined), [id]);

  const firstIds = mission?.participantIds.slice(0, 3).join(',') ?? '';
  useEffect(() => {
    if (!firstIds) return;
    fetchUserProfiles(firstIds.split(',')).then((p) => setPeople(Object.values(p).map((u) => ({
      uid: u.uid, name: u.name, avatarColor: u.avatarColor, photoUri: u.photoUri,
    }))));
  }, [firstIds]);

  // Distance only if location is already allowed — never prompts from here.
  const lat = mission?.latitude;
  const lng = mission?.longitude;
  useEffect(() => {
    if (lat == null || lng == null) return;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getLastKnownPositionAsync();
      if (pos) setDistanceKm(haversineKm(pos.coords.latitude, pos.coords.longitude, lat, lng));
    })().catch(() => {});
  }, [lat, lng]);

  if (mission === undefined || !user) return <LoadingScreen />;
  if (mission === null) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.body, { color: colors.textHint }]}>{t.kfgError('not-published')}</Text>
        <Button label={t.settingsBtnCancel} variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const locale = getDateLocale(language);
  const isMine = mission.creatorId === user.id;
  const studentRun = mission.creatorType === 'student';
  const over = mission.endsAt.getTime() <= now;
  const started = mission.startsAt.getTime() <= now;
  const spotsLeft = mission.capacity - mission.participantCount;
  const joined = !!participation && participation.status !== 'cancelled';
  const minDuration = t.kfgDuration(Math.floor(mission.minDurationMin / 60), mission.minDurationMin % 60);
  const timeLine = `${format(mission.startsAt, 'HH:mm')}–${format(mission.endsAt, 'HH:mm')}`
    + (mission.kind === 'partnerQr' && mission.minDurationMin > 0 ? ` · ${t.kfgMinDuration(minDuration)}` : '');
  const placeLine = [mission.address, distanceKm != null ? `${distanceKm.toFixed(1).replace('.', language === 'el' ? ',' : '.')} km` : null]
    .filter(Boolean).join(' · ');

  const join = async () => {
    setBusy(true);
    const r = await kfgRepository.join(mission.id);
    setBusy(false);
    if (isLeft(r)) { haptics.error(); Alert.alert(mission.title, t.kfgError(r.left.message)); return; }
    haptics.success();
    analytics.track('kfg_mission_joined', { missionId: mission.id, kind: mission.kind });
  };

  const leave = () => Alert.alert(t.kfgLeaveBtn, t.kfgLeaveConfirm, [
    { text: t.settingsBtnCancel, style: 'cancel' },
    {
      text: t.kfgLeaveBtn, style: 'destructive',
      onPress: async () => {
        const r = await kfgRepository.leave(mission.id);
        if (isLeft(r)) Alert.alert(mission.title, t.kfgError(r.left.message));
      },
    },
  ]);

  const status = participation?.status;
  const canVerify = joined && !over && (status === 'joined' || status === 'checkedIn');

  let action: React.ReactNode;
  if (isMine && mission.status !== 'published') {
    action = <Button label={t.kfgMissionState(mission.status, over)} disabled onPress={() => {}} />;
  } else if (isMine) {
    action = mission.kind === 'partnerQr'
      ? <Button label={t.kfgScanBtn} onPress={() => router.push(`/(app)/kfg/scan?missionId=${mission.id}` as any)} disabled={over} />
      : null;
  } else if (status === 'completed' || status === 'verified' || status === 'inReview') {
    action = <Button label={t.kfgOverBtn} variant="soft" onPress={() => router.push(`/(app)/kfg/complete/${mission.id}` as any)} />;
  } else if (canVerify) {
    action = <Button label={t.kfgVerifyBtn} onPress={() => router.push(`/(app)/kfg/verify/${mission.id}` as any)} />;
  } else if (over) {
    action = <Button label={t.kfgOverBtn} disabled onPress={() => {}} />;
  } else if (spotsLeft <= 0) {
    action = <Button label={t.kfgFullBtn} disabled onPress={() => {}} />;
  } else if (!user.isOrganization) {
    action = <Button label={t.kfgJoinBtn} onPress={join} loading={busy} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View style={[styles.hero, { backgroundColor: colors.accentSoft, paddingTop: insets.top }]}>
          <Icon name={CAUSE_ICONS[mission.cause]} size={56} color={colors.primary} strokeWidth={1.4} />
          <AnimatedPressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t.kfgBackA11y}
            hitSlop={8}
            style={[styles.backBtn, { top: insets.top + 10, backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name="back" size={17} color={colors.textPrimary} />
          </AnimatedPressable>
        </View>

        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: colors.accentInk }]}>{t.kfgEyebrow(mission.kind, studentRun).toUpperCase()}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{mission.title}</Text>
          {isMine && mission.status === 'pending' && (
            <Text style={[styles.status, { color: colors.accentInk }]}>{t.kfgAwaitingApproval}</Text>
          )}
          {joined && status && t.kfgStatusLine(status) !== '' && (
            <Text style={[styles.status, { color: colors.accentInk }]}>{t.kfgStatusLine(status)}</Text>
          )}

          <View style={styles.rows}>
            <InfoRow icon="clock" title={format(mission.startsAt, 'EEEE d MMMM', { locale })} subtitle={timeLine} />
            <InfoRow icon="shield" title={mission.creatorName} subtitle={t.kfgOrganizerRow} />
            <InfoRow icon="pin" title={mission.areaLabel} subtitle={placeLine || undefined} />
            <InfoRow icon="qr" title={t.kfgVerifyLabel(mission.kind, studentRun)} subtitle={t.kfgVerifyHow(mission.kind, studentRun)} />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {firstIds && people.length > 0 ? (
            <AvatarPile
              profiles={people}
              totalCount={mission.participantCount}
              caption={t.kfgParticipants(people[0].name.split(' ')[0], mission.participantCount - 1)}
            />
          ) : (
            <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgNoParticipants}</Text>
          )}

          <Text style={[styles.body, { color: colors.textPrimary }]}>{mission.description}</Text>

          {(mission.infoText || mission.kind === 'photo' || studentRun) && (
            <Card padded style={[styles.info, { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}>
              <Text style={[styles.infoTitle, { color: colors.accentInk }]}>{t.kfgInfoTitle}</Text>
              {!!mission.infoText && <Text style={[styles.meta, { color: colors.textPrimary }]}>{mission.infoText}</Text>}
              {mission.kind === 'photo' && <Text style={[styles.meta, { color: colors.textPrimary }]}>{t.kfgPhotoNotRanked}</Text>}
              {studentRun && <Text style={[styles.meta, { color: colors.textPrimary }]}>{t.kfgStudentRule(KFG_LIMITS.studentMinVerified)}</Text>}
            </Card>
          )}

          {joined && status === 'joined' && !started && (
            <Button label={t.kfgLeaveBtn} variant="ghost" onPress={leave} />
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.textPrimary }]}>
          {t.kfgFooter(formatPoints(mission.points, language), mission.participantCount, mission.capacity)}
        </Text>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.gutter },
  hero: { height: 200, alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    position: 'absolute', left: Spacing.gutter, width: 34, height: 34, borderRadius: 17, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: Spacing.gutter, gap: Spacing.md },
  eyebrow: { fontFamily: UIFont, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1.4 },
  title: { fontFamily: TitleFont, fontSize: 25, fontWeight: FontWeight.bold, letterSpacing: -0.6, marginTop: -4 },
  status: { fontFamily: UIFont, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  rows: { gap: 13, marginTop: 4 },
  divider: { height: 1, marginVertical: 4 },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19 },
  body: { fontFamily: UIFontLight, fontSize: FontSize.base, lineHeight: 21 },
  info: { gap: 6 },
  infoTitle: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1,
    paddingTop: 12, paddingHorizontal: Spacing.gutter, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  footerText: { flex: 1, fontFamily: UIFont, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
