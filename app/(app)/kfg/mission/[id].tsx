import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
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
import { universityLabel } from '@/core/constants/universities';
import { KfgPhotoWall } from '@/components/kfg/KfgPhotoWall';
import { FEATURES } from '@/core/constants/features';
import { KfgParticipants } from '@/components/kfg/KfgParticipants';
import { KfgLiveMode } from '@/components/kfg/KfgLiveMode';
import { KfgRequests } from '@/components/kfg/KfgRequests';
import { KfgRollCall } from '@/components/kfg/KfgRollCall';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { KfgInviteModal } from '@/components/kfg/KfgInviteModal';
import { KfgRequestModal } from '@/components/kfg/KfgRequestModal';
import { publicMissionUrl } from '@/core/constants/publicLinks';
import { addToCalendar, isEventInCalendar, removeEventFromCalendar } from '@/core/utils/calendar';

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

  const [showInvite, setShowInvite] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [inCalendar, setInCalendar] = useState(false);
  useEffect(() => { if (id) isEventInCalendar(id).then(setInCalendar); }, [id]);

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
  const over = mission.endsAt.getTime() <= now || mission.endedEarly;
  const started = mission.startsAt.getTime() <= now;
  const spotsLeft = mission.capacity - mission.participantCount;
  const joined = !!participation && participation.status !== 'cancelled';
  const minDuration = t.kfgDuration(Math.floor(mission.minDurationMin / 60), mission.minDurationMin % 60);
  const timeLine = `${format(mission.startsAt, 'HH:mm')}–${format(mission.endsAt, 'HH:mm')}`
    + (mission.kind === 'partnerQr' && mission.minDurationMin > 0 ? ` · ${t.kfgMinDuration(minDuration)}` : '');
  const placeLine = [mission.address, distanceKm != null ? `${distanceKm.toFixed(1).replace('.', language === 'el' ? ',' : '.')} km` : null]
    .filter(Boolean).join(' · ');

  const share = async () => {
    haptics.light();
    const when = format(mission.startsAt, 'EEE d MMM, HH:mm', { locale });
    const link = mission.status === 'published' ? publicMissionUrl(mission.id) : `keno://kfg/mission/${mission.id}`;
    const result = await Share.share({
      title: mission.title,
      message: `💚 ${mission.title}\n📌 ${mission.areaLabel}\n⏰ ${when}\n\n${t.eventShareCta}\n${link}`,
    });
    if (result.action !== 'dismissedAction') analytics.track('kfg_mission_shared', { missionId: mission.id });
  };

  const toggleCalendar = async () => {
    haptics.light();
    if (inCalendar) {
      if (await removeEventFromCalendar(mission.id)) setInCalendar(false);
      return;
    }
    const ok = await addToCalendar({
      id: mission.id, title: mission.title, start: mission.startsAt, end: mission.endsAt, notes: mission.description,
      location: [mission.address, mission.areaLabel].filter(Boolean).join(', '),
    });
    if (ok) { setInCalendar(true); haptics.success(); }
  };

  const join = async () => {
    setBusy(true);
    const r = await kfgRepository.join(mission.id);
    setBusy(false);
    if (isLeft(r)) { haptics.error(); Alert.alert(mission.title, t.kfgError(r.left.message)); return; }
    haptics.success();
    if (r.right.waitlisted) {
      Alert.alert(mission.title, t.kfgWaitlistedAlert);
      analytics.track('kfg_mission_waitlisted', { missionId: mission.id });
      return;
    }
    analytics.track('kfg_mission_joined', { missionId: mission.id, kind: mission.kind });
  };

  const requestJoin = async (message: string) => {
    setBusy(true);
    const r = await kfgRepository.requestJoin(mission.id, message);
    setBusy(false);
    if (isLeft(r)) { haptics.error(); Alert.alert(mission.title, t.kfgError(r.left.message)); return; }
    setShowRequest(false);
    haptics.success();
  };

  const report = () => {
    Alert.alert(t.eventReportTitle, undefined, [
      { text: t.eventReportSpam, onPress: () => submitReport('spam') },
      { text: t.eventReportInappropriate, onPress: () => submitReport('inappropriate') },
      { text: t.eventReportMisinformation, onPress: () => submitReport('misinformation') },
      { text: t.settingsBtnCancel, style: 'cancel' },
    ]);
  };

  // Same reports collection as events (admin-reports.tsx shows the mission).
  const submitReport = async (reason: string) => {
    try {
      await addDoc(collection(db, 'reports'), {
        reportedMissionId: mission.id,
        reportedUid: mission.creatorId,
        reporterUid: user.id,
        reason,
        createdAt: new Date(),
      });
      Alert.alert(t.eventReportSubmitted, t.eventReportSubmittedBody);
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
  };

  const cancelMission = () => Alert.alert(t.kfgCancelConfirmTitle, t.kfgCancelConfirmBody, [
    { text: t.settingsBtnCancel, style: 'cancel' },
    {
      text: t.kfgCancelBtn,
      style: 'destructive',
      onPress: async () => {
        const r = await kfgRepository.cancelMission(mission.id);
        if (isLeft(r)) Alert.alert(mission.title, t.kfgError(r.left.message));
        else { haptics.success(); router.back(); }
      },
    },
  ]);

  const claimStandIn = () => Alert.alert(t.kfgStandInBtn, t.kfgStandInConfirm, [
    { text: t.settingsBtnCancel, style: 'cancel' },
    {
      text: 'OK',
      onPress: async () => {
        const r = await kfgRepository.claimStandIn(mission.id);
        if (isLeft(r)) Alert.alert(mission.title, t.kfgError(r.left.message));
        else haptics.success();
      },
    },
  ]);

  const sendFeedback = async (value: 'good' | 'bad') => {
    haptics.light();
    setFeedbackSent(true);
    const r = await kfgRepository.feedback(mission.id, value);
    if (isLeft(r)) setFeedbackSent(false);
  };

  const toggleCoHost = (uid: string, name: string) => {
    const on = !mission.coHostIds.includes(uid);
    Alert.alert(on ? t.kfgMakeCoHost(name) : t.kfgRemoveCoHost(name), undefined, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: 'OK',
        onPress: async () => {
          const r = await kfgRepository.setCoHost(mission.id, uid, on);
          if (isLeft(r)) Alert.alert(mission.title, t.kfgError(r.left.message));
          else haptics.success();
        },
      },
    ]);
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

  // Same rule as kfgJoin on the server: unknown age/university doesn't block.
  const ineligible: 'age-restricted' | 'uni-restricted' | null =
    user.age != null && ((mission.minAge != null && user.age < mission.minAge) || (mission.maxAge != null && user.age > mission.maxAge))
      ? 'age-restricted'
      : user.universityName && (mission.allowedUniversities?.length ?? 0) > 0 && !mission.allowedUniversities!.includes(user.universityName)
        ? 'uni-restricted'
        : null;
  const genderLine = mission.genderFilter === 'male' ? t.eventGenderMaleOnly : mission.genderFilter === 'female' ? t.eventGenderFemaleOnly : null;
  const ageLine = mission.minAge != null || mission.maxAge != null ? `${t.eventFilterAge} ${mission.minAge ?? 18}–${mission.maxAge ?? '∞'}` : null;
  const uniLine = mission.allowedUniversities?.map((u) => universityLabel(u, language)).join(', ') ?? null;
  const filterLine = [genderLine, ageLine, uniLine].filter(Boolean).join(' · ');

  const isCoHost = mission.coHostIds.includes(user.id);
  const runs = isMine || isCoHost;
  const waitlistPos = mission.waitlistIds.indexOf(user.id) + 1;
  const requested = user.id in mission.joinRequests;

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
  } else if (waitlistPos > 0) {
    action = <Button label={t.kfgOnWaitlist(waitlistPos)} variant="soft" onPress={leave} />;
  } else if (ineligible && !joined) {
    action = <Button label={t.kfgNotEligibleBtn} disabled onPress={() => {}} />;
  } else if (user.isOrganization) {
    action = null;
  } else if (mission.isPrivate) {
    action = requested
      ? <Button label={t.kfgRequestSent} disabled onPress={() => {}} />
      : <Button label={t.kfgRequestBtn} onPress={() => setShowRequest(true)} />;
  } else if (spotsLeft <= 0) {
    action = <Button label={t.kfgWaitlistBtn} variant="soft" onPress={join} loading={busy} />;
  } else {
    action = <Button label={t.kfgJoinBtn} onPress={join} loading={busy} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View style={[styles.hero, { backgroundColor: colors.accentSoft, paddingTop: insets.top }]}>
          {mission.imageUri
            ? <Image source={{ uri: mission.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <Icon name={CAUSE_ICONS[mission.cause]} size={56} color={colors.primary} strokeWidth={1.4} />}
          <AnimatedPressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t.kfgBackA11y}
            hitSlop={8}
            style={[styles.backBtn, { top: insets.top + 10, backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name="back" size={17} color={colors.textPrimary} />
          </AnimatedPressable>
          {!isMine && (
            <AnimatedPressable
              onPress={report}
              accessibilityRole="button"
              accessibilityLabel={t.eventReportBtn}
              hitSlop={8}
              style={[styles.backBtn, styles.reportBtn, { top: insets.top + 10, backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Icon name="flag" size={15} color={colors.textPrimary} />
            </AnimatedPressable>
          )}
        </View>

        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: colors.accentInk }]}>{t.kfgEyebrow(mission.kind, studentRun).toUpperCase()}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{mission.title}</Text>
          {isMine && mission.status === 'pending' && (
            <Text style={[styles.status, { color: colors.accentInk }]}>{t.kfgAwaitingApproval}</Text>
          )}
          {ineligible && !joined && !isMine && (
            <Text style={[styles.status, { color: colors.error }]}>{t.kfgError(ineligible)}</Text>
          )}
          {joined && status && t.kfgStatusLine(status) !== '' && (
            <Text style={[styles.status, { color: colors.accentInk }]}>{t.kfgStatusLine(status)}</Text>
          )}

          <View style={styles.rows}>
            <InfoRow icon="clock" title={format(mission.startsAt, 'EEEE d MMMM', { locale })} subtitle={timeLine} />
            <InfoRow icon="shield" title={mission.creatorName} subtitle={t.kfgOrganizerRow} />
            <InfoRow icon="pin" title={mission.areaLabel} subtitle={placeLine || undefined} />
            <InfoRow icon="qr" title={t.kfgVerifyLabel(mission.kind, studentRun)} subtitle={t.kfgVerifyHow(mission.kind, studentRun)} />
            {mission.groupId && mission.groupName && (
              <AnimatedPressable onPress={() => router.push(`/(app)/group/${mission.groupId}` as any)} accessibilityRole="button">
                <InfoRow icon="users" title={mission.groupName} subtitle={t.kfgCommunityRow} />
              </AnimatedPressable>
            )}
            {(filterLine || mission.soloFriendly) && (
              <InfoRow
                icon="users"
                title={filterLine || t.createSoloFriendlyLabel}
                subtitle={filterLine && mission.soloFriendly ? t.createSoloFriendlyLabel : t.kfgFiltersTitle}
              />
            )}
          </View>

          {/* Live Mode — like events: only while it's running, for whoever's
              actually there (checked in), plus the creator. */}
          {started && !over && (isMine || status === 'checkedIn') && (
            <KfgLiveMode mission={mission} user={user} isCreator={isMine} />
          )}

          {isMine && !started && (mission.status === 'pending' || mission.status === 'published') && (
            <View style={styles.quickRow}>
              <Button
                label={t.kfgEditBtn}
                variant="outline"
                size="sm"
                onPress={() => router.push(`/(app)/kfg/create?edit=${mission.id}` as any)}
                style={styles.flex}
              />
              <Button label={t.kfgCancelBtn} variant="outline" size="sm" onPress={cancelMission} style={styles.flex} />
            </View>
          )}

          {/* Stand-in host (like events): the creator hasn't scanned anyone
              15 minutes in, so a participant can take over. */}
          {joined && !runs && mission.kind === 'partnerQr' && !mission.standInHostId && mission.presentIds.length === 0
            && now >= mission.startsAt.getTime() + 15 * 60_000 && !over && (
            <Button label={t.kfgStandInBtn} variant="outline" onPress={claimStandIn} fullWidth />
          )}
          {mission.standInHostId === user.id && (
            <Text style={[styles.status, { color: colors.accentInk }]}>{t.eventStandInBadge}</Text>
          )}

          {/* Roll-call fallback for codes that won't scan. */}
          {runs && mission.kind === 'partnerQr' && mission.status === 'published'
            && now >= mission.startsAt.getTime() - 30 * 60_000 && !over && (
            <KfgRollCall mission={mission} me={user.id} />
          )}

          <View style={styles.quickRow}>
            <Button label={t.eventShareAction} variant="outline" size="sm" onPress={share} style={styles.flex} />
            <Button
              label={inCalendar ? t.eventInCalendar : t.eventAddToCalendar}
              variant={inCalendar ? 'soft' : 'outline'}
              size="sm"
              onPress={toggleCalendar}
              style={styles.flex}
            />
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

          {(isMine || joined) && (
            <Button
              label={t.kfgChatBtn}
              variant="outline"
              onPress={() => router.push(`/(app)/event-chat/${mission.id}?kfg=1` as any)}
              fullWidth
            />
          )}

          {runs && <KfgRequests mission={mission} />}

          {isCoHost && mission.kind === 'partnerQr' && !over && (
            <Button label={t.kfgScanBtn} variant="outline" onPress={() => router.push(`/(app)/kfg/scan?missionId=${mission.id}` as any)} fullWidth />
          )}

          {FEATURES.rides && mission.ridesEnabled && (joined || runs) && !over && (
            <Button label={t.ridesTitle} variant="outline" onPress={() => router.push(`/(app)/event/rides/${mission.id}?kfg=1` as any)} fullWidth />
          )}

          {(joined || runs) && !over && mission.status === 'published' && (
            <Button label={t.kfgInviteBtn} variant="outline" onPress={() => setShowInvite(true)} fullWidth />
          )}

          {isMine && !over && mission.participantIds.length > 0 && (
            <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgCoHostHint}</Text>
          )}
          {/* Private "how was it?" — once, for whoever was there, after it's over. */}
          {over && mission.presentIds.includes(user.id) && participation && !participation.feedback && !feedbackSent && (
            <Card padded style={styles.info}>
              <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{t.eventFeedbackQuestion}</Text>
              <View style={styles.quickRow}>
                <Button label={t.eventFeedbackGood} variant="soft" size="sm" onPress={() => sendFeedback('good')} style={styles.flex} />
                <Button label={t.eventFeedbackBad} variant="outline" size="sm" onPress={() => sendFeedback('bad')} style={styles.flex} />
              </View>
            </Card>
          )}

          <KfgParticipants mission={mission} user={user} over={over} onLongPress={isMine ? toggleCoHost : undefined} />

          {over && mission.presentIds.includes(user.id) && mission.presentIds.length > 1 && (
            <Button
              label={t.eventReconnectCta}
              onPress={() => router.push(`/(app)/swipes/${mission.id}?kfg=1` as any)}
              fullWidth
            />
          )}

          {mission.photoWall && <KfgPhotoWall missionId={mission.id} user={user} status={participation?.status} />}

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

      <KfgRequestModal visible={showRequest} busy={busy} onClose={() => setShowRequest(false)} onSend={requestJoin} />
      <KfgInviteModal visible={showInvite} onClose={() => setShowInvite(false)} mission={mission} user={user} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.gutter },
  hero: { height: 200, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  reportBtn: { left: undefined, right: Spacing.gutter },
  backBtn: {
    position: 'absolute', left: Spacing.gutter, width: 34, height: 34, borderRadius: 17, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: Spacing.gutter, gap: Spacing.md },
  eyebrow: { fontFamily: UIFont, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1.4 },
  title: { fontFamily: TitleFont, fontSize: 25, fontWeight: FontWeight.bold, letterSpacing: -0.6, marginTop: -4 },
  status: { fontFamily: UIFont, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  rows: { gap: 13, marginTop: 4 },
  quickRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  flex: { flex: 1 },
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
