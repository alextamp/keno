import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { AvatarPile } from '@/components/ui/AvatarPile';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { AccentScopeProvider, LightColors, useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgMission, KfgParticipation } from '@/features/kfg/domain/entities/kfg.entity';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { buildKfgQrCode, msUntilNextBucket } from '@/features/kfg/qr';

const SECRET_KEY = (participationId: string) => `kfg_qr_secret_${participationId}`;
const DONE_STATUSES = ['completed', 'verified', 'inReview'];

export default function KfgVerifyScreen() {
  return (
    <AccentScopeProvider value="kfg">
      <VerifyInner />
    </AccentScopeProvider>
  );
}

function VerifyInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslation();
  const participation = useKfgStore((s) => (id ? s.participationFor(id) : undefined));
  const [mission, setMission] = useState<KfgMission | null | undefined>(undefined);

  useEffect(() => (id ? kfgRepository.subscribeMission(id, setMission) : undefined), [id]);

  // The server flips the participation the moment it's verified — go straight to the result.
  const status = participation?.status;
  useEffect(() => {
    if (status && DONE_STATUSES.includes(status)) router.replace(`/(app)/kfg/complete/${id}` as any);
  }, [status]);

  if (!mission || !participation) return <LoadingScreen />;

  const studentRun = mission.creatorType === 'student';
  const tabLabel = t.kfgVerifyLabel(mission.kind, studentRun);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: Spacing.gutter }}>
        <ScreenHeader title={t.kfgVerifyTitle} />
      </View>
      <SegmentedTabs tabs={[tabLabel]} activeIndex={0} onChange={() => {}} style={styles.tabs} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.missionTitle, { color: colors.textPrimary }]} numberOfLines={2}>{mission.title}</Text>
        {mission.kind === 'partnerQr' && <QrView mission={mission} participation={participation} />}
        {mission.kind === 'photo' && <PhotoView participation={participation} />}
        {mission.kind === 'group' && <GroupView mission={mission} />}
      </ScrollView>
    </View>
  );
}

// ── QR ─────────────────────────────────────────────────────────────────────

function QrView({ mission, participation }: { mission: KfgMission; participation: KfgParticipation }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const [secret, setSecret] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now);

  // The secret is cached on the device so the code still works with no signal on site.
  useEffect(() => {
    const key = SECRET_KEY(participation.id);
    AsyncStorage.getItem(key).then(async (cached) => {
      if (cached) { setSecret(cached); return; }
      const r = await kfgRepository.getQrSecret(participation.id);
      if (isLeft(r)) { setFailed(true); return; }
      setSecret(r.right);
      AsyncStorage.setItem(key, r.right).catch(() => {});
    }).catch(() => setFailed(true));
  }, [participation.id]);

  // Re-render exactly when the 30s bucket rolls over (the timer line moves with it).
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), msUntilNextBucket(now) + 50);
    return () => clearTimeout(timer);
  }, [now]);

  const checkedInAt = participation.status === 'checkedIn' ? participation.checkInAt : undefined;
  const elapsedMin = checkedInAt ? Math.max(0, Math.floor((now - checkedInAt.getTime()) / 60_000)) : 0;
  const dur = (m: number) => t.kfgDuration(Math.floor(m / 60), m % 60);

  return (
    <View style={styles.block}>
      <Card padded style={styles.qrCard}>
        {secret ? (
          <QRCode value={buildKfgQrCode(secret, participation.id, now)} size={220} color={colors.textPrimary} backgroundColor={colors.surface} />
        ) : failed ? (
          <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgQrOffline}</Text>
        ) : (
          <View style={styles.qrPlaceholder} />
        )}
      </Card>
      <Text style={[styles.body, { color: colors.textPrimary }]}>{t.kfgQrHint}</Text>
      <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgQrRefreshes}</Text>

      {checkedInAt && (
        <Card padded style={styles.timer}>
          <View style={styles.timerRow}>
            <Text style={[styles.timerText, { color: colors.textPrimary }]}>{t.kfgOnSite(dur(elapsedMin))}</Text>
            {mission.minDurationMin > 0 && (
              <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgOnSiteMin(dur(mission.minDurationMin))}</Text>
            )}
          </View>
          {mission.minDurationMin > 0 && <ProgressTrack progress={elapsedMin / mission.minDurationMin} />}
        </Card>
      )}
    </View>
  );
}

// ── Photo ──────────────────────────────────────────────────────────────────

type Side = 'before' | 'after';

function PhotoView({ participation }: { participation: KfgParticipation }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [cameraFor, setCameraFor] = useState<Side | null>(null);
  const [local, setLocal] = useState<Partial<Record<Side, { uri: string; at: Date; uploading: boolean }>>>({});

  const has = (side: Side) => !!participation.photos[side] || (local[side] && !local[side]!.uploading);

  const open = async (side: Side) => {
    if (side === 'after' && !has('before')) { Alert.alert(t.kfgPhotoAfter, t.kfgPhotoAfterFirst); return; }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { Alert.alert(t.kfgVerifyTitle, t.kfgPhotoLocationNeeded); return; }
    setCameraFor(side);
  };

  const onShot = async (side: Side, uri: string) => {
    setCameraFor(null);
    if (!user) return;
    const at = new Date();
    setLocal((p) => ({ ...p, [side]: { uri, at, uploading: true } }));
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
    if (!pos) {
      setLocal((p) => ({ ...p, [side]: undefined }));
      Alert.alert(t.kfgVerifyTitle, t.kfgPhotoLocationNeeded);
      return;
    }
    const r = await kfgRepository.uploadPhoto({
      uid: user.id, participationId: participation.id, side, localUri: uri, takenAt: at,
      latitude: pos.coords.latitude, longitude: pos.coords.longitude,
    });
    if (isLeft(r)) {
      setLocal((p) => ({ ...p, [side]: undefined }));
      Alert.alert(t.kfgVerifyTitle, t.kfgError(r.left.message));
      return;
    }
    haptics.success();
    setLocal((p) => ({ ...p, [side]: { uri, at, uploading: false } }));
  };

  return (
    <View style={styles.block}>
      <View style={styles.photoRow}>
        {(['before', 'after'] as Side[]).map((side) => {
          const shot = local[side];
          const uploaded = !!participation.photos[side] || (shot && !shot.uploading);
          return (
            <AnimatedPressable
              key={side}
              onPress={() => !uploaded && !shot?.uploading && open(side)}
              accessibilityRole="button"
              accessibilityLabel={`${side === 'before' ? t.kfgPhotoBefore : t.kfgPhotoAfter}: ${uploaded ? t.kfgPhotoUploaded : t.kfgPhotoTake}`}
              style={[styles.photoTile, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              {shot ? (
                <Image source={{ uri: shot.uri }} style={styles.photoImg} />
              ) : (
                <View style={[styles.photoEmpty, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="camera" size={26} color={colors.primary} />
                </View>
              )}
              <Text style={[styles.photoLabel, { color: colors.textPrimary }]}>{side === 'before' ? t.kfgPhotoBefore : t.kfgPhotoAfter}</Text>
              <Text style={[styles.meta, { color: uploaded ? colors.accentInk : colors.textHint }]}>
                {shot?.uploading ? t.kfgPhotoUploading
                  : uploaded ? `${t.kfgPhotoUploaded}${shot ? ` · ${format(shot.at, 'HH:mm')}` : ''}` : t.kfgPhotoTake}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <Card padded style={styles.rules}>
        {t.kfgPhotoRules.map((rule) => (
          <View key={rule} style={styles.ruleRow}>
            <Icon name="check" size={14} color={colors.primary} />
            <Text style={[styles.meta, styles.flex, { color: colors.textPrimary }]}>{rule}</Text>
          </View>
        ))}
      </Card>
      <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgPhotoNotRanked}</Text>

      <CameraModal side={cameraFor} onClose={() => setCameraFor(null)} onShot={onShot} />
    </View>
  );
}

/** In-app camera only — no gallery, so the photo is taken now, on site. */
function CameraModal({ side, onClose, onShot }: { side: Side | null; onClose: () => void; onShot: (side: Side, uri: string) => void }) {
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [taking, setTaking] = useState(false);

  const shoot = async () => {
    if (!side || taking) return;
    setTaking(true);
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7, exif: false }).catch(() => null);
    setTaking(false);
    if (photo?.uri) onShot(side, photo.uri);
  };

  return (
    <Modal visible={side !== null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.cameraRoot}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={styles.flex} facing="back" />
        ) : (
          <View style={[styles.flex, styles.cameraGate]}>
            <Text style={styles.cameraGateText}>{t.kfgCameraNeeded}</Text>
            <Button label={t.kfgCameraAllow} onPress={requestPermission} />
          </View>
        )}
        <View style={[styles.cameraBar, { paddingBottom: insets.bottom + 20 }]}>
          <AnimatedPressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t.settingsBtnCancel} style={styles.cameraSide}>
            <Icon name="x" size={22} color={LightColors.white} />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={shoot}
            disabled={!permission?.granted}
            accessibilityRole="button"
            accessibilityLabel={t.kfgPhotoTake}
            style={styles.shutter}
          >
            <View style={styles.shutterInner} />
          </AnimatedPressable>
          <View style={styles.cameraSide} />
        </View>
      </View>
    </Modal>
  );
}

// ── Group ──────────────────────────────────────────────────────────────────

function GroupView({ mission }: { mission: KfgMission }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [now] = useState(Date.now);

  const others = mission.participantIds.filter((u) => u !== user?.id).join(',');
  useEffect(() => {
    if (!others) return;
    fetchUserProfiles(others.split(',')).then((p) => setPeople(Object.values(p)));
  }, [others]);

  if (now < mission.startsAt.getTime()) {
    return <Text style={[styles.body, { color: colors.textHint }]}>{t.kfgGroupNotYet}</Text>;
  }

  const toggle = (uid: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    return next;
  });

  const save = async () => {
    setSaving(true);
    const r = await kfgRepository.confirmPeers(mission.id, [...picked]);
    setSaving(false);
    if (isLeft(r)) { Alert.alert(t.kfgVerifyTitle, t.kfgError(r.left.message)); return; }
    haptics.success();
    Alert.alert(t.kfgVerifyTitle, t.kfgGroupSaved);
  };

  return (
    <View style={styles.block}>
      <Text style={[styles.body, { color: colors.textPrimary }]}>{t.kfgGroupIntro}</Text>
      <Card>
        {people.map((p, i) => {
          const on = picked.has(p.uid);
          return (
            <AnimatedPressable
              key={p.uid}
              onPress={() => toggle(p.uid)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.name}
              style={[styles.personRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <AvatarPile profiles={[{ uid: p.uid, name: p.name, avatarColor: p.avatarColor, photoUri: p.photoUri }]} size={32} />
              <Text style={[styles.personName, { color: colors.textPrimary }]}>{p.name}</Text>
              <View style={[styles.check, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : 'transparent' }]}>
                {on && <Icon name="check" size={14} color={colors.surface} />}
              </View>
            </AnimatedPressable>
          );
        })}
      </Card>
      <Button label={t.kfgGroupConfirmBtn(picked.size)} onPress={save} loading={saving} disabled={picked.size === 0} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  tabs: { marginTop: Spacing.sm },
  content: { padding: Spacing.gutter, gap: Spacing.md },
  missionTitle: { fontFamily: TitleFont, fontSize: FontSize.xl, fontWeight: FontWeight.bold, letterSpacing: -0.25 },
  block: { gap: Spacing.md },
  body: { fontFamily: UIFontLight, fontSize: FontSize.base, lineHeight: 21 },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19 },
  qrCard: { alignItems: 'center', paddingVertical: Spacing.lg },
  qrPlaceholder: { width: 220, height: 220 },
  timer: { gap: Spacing.sm },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm },
  timerText: { flex: 1, fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  photoRow: { flexDirection: 'row', gap: Spacing.md },
  photoTile: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.sm, gap: 4 },
  photoImg: { width: '100%', aspectRatio: 1, borderRadius: BorderRadius.xs },
  photoEmpty: { width: '100%', aspectRatio: 1, borderRadius: BorderRadius.xs, alignItems: 'center', justifyContent: 'center' },
  photoLabel: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  rules: { gap: Spacing.sm },
  ruleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.base, minHeight: 56 },
  personName: { flex: 1, fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cameraRoot: { flex: 1, backgroundColor: LightColors.black },
  cameraGate: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.gutter },
  cameraGateText: { color: LightColors.white, fontFamily: UIFont, fontSize: FontSize.lg, textAlign: 'center' },
  cameraBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: Spacing.base },
  cameraSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: LightColors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: LightColors.white },
});
