import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { sounds } from '@/core/utils/sounds';
import { analytics } from '@/core/utils/analytics';

// Camera check-in scanner (mockup 16). The QR the organizer displays encodes
// `keno:checkin:{eventId}:{secret}:{bucket}` — bucket is a 30s-rotating
// window, verified server-side by firestore.rules against the event's
// private secret doc. See events.repository.impl.ts `checkInWithToken`.
export default function CheckInScannerScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission?.granted]);

  const handleBarcodeScanned = useCallback(async (result: { data: string }) => {
    if (scannedRef.current || processing || !user || !eventId) return;
    const parts = result.data.split(':');
    // keno : checkin : eventId : secret : bucket
    if (parts.length !== 5 || parts[0] !== 'keno' || parts[1] !== 'checkin') return;
    if (parts[2] !== eventId) {
      haptics.error();
      Alert.alert(t.checkinInvalidTitle, t.checkinWrongEventBody);
      return;
    }
    const secret = parts[3];
    const bucket = Number(parts[4]);
    if (!secret || !Number.isFinite(bucket)) return;

    scannedRef.current = true;
    setProcessing(true);
    const result_ = await eventsRepository.checkInWithToken(eventId, user.id, secret, bucket);
    if (isLeft(result_)) {
      haptics.error();
      Alert.alert(t.checkinInvalidTitle, t.checkinInvalidBody, [
        { text: t.settingsBtnCancel, onPress: () => { scannedRef.current = false; setProcessing(false); } },
      ]);
      return;
    }
    haptics.success();
    sounds.play('success');
    analytics.track('checkin_completed', { eventId });
    router.replace(`/(app)/checkin/success/${eventId}`);
  }, [eventId, processing, user, t]);

  const handleCantFindCode = () => {
    Alert.alert(t.checkinCantFindTitle, t.checkinCantFindBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      { text: t.checkinBack, onPress: () => router.back() },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="x" size={18} color="#fff" />
        </AnimatedPressable>
        <Text style={styles.topTitle}>{t.checkinTitle}</Text>
        <View style={{ width: 34 }} />
      </View>

      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scannedRef.current ? undefined : handleBarcodeScanned}
        />
      ) : (
        <View style={styles.permissionGate}>
          <Icon name="camera" size={40} color="#B9AA99" />
          <Text style={styles.permissionTitle}>{t.checkinPermissionTitle}</Text>
          <Text style={styles.permissionBody}>{t.checkinPermissionBody}</Text>
          <Button label={t.checkinPermissionBtn} onPress={requestPermission} variant="primary" style={{ marginTop: Spacing.lg }} />
        </View>
      )}

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      <View style={styles.captionWrap} pointerEvents="none">
        {processing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.captionTitle}>{t.checkinScanHint}</Text>
            <Text style={styles.captionSub}>{t.checkinScanSub}</Text>
          </>
        )}
      </View>

      <View style={[styles.bottomWrap, { paddingBottom: insets.bottom + 20 }]}>
        <AnimatedPressable onPress={handleCantFindCode} style={styles.ghostBtn}>
          <Text style={styles.ghostBtnLabel}>{t.checkinCantFindTitle}</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const FRAME_SIZE = 220;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter,
  },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  permissionGate: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm,
  },
  permissionTitle: { color: '#fff', fontSize: FontSize.xl, fontFamily: TitleFont, fontWeight: FontWeight.semibold, marginTop: Spacing.sm, textAlign: 'center' },
  permissionBody: { color: '#B9AA99', fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  frame: { width: FRAME_SIZE, height: FRAME_SIZE },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#D9603C', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  captionWrap: {
    position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 2,
    top: '50%', marginTop: FRAME_SIZE / 2 + 26, paddingHorizontal: Spacing.xl,
  },
  captionTitle: { color: '#fff', fontSize: FontSize.xl, fontFamily: TitleFont, fontWeight: FontWeight.semibold },
  captionSub: { color: '#B9AA99', fontSize: FontSize.sm, marginTop: 7, textAlign: 'center' },
  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: Spacing.gutter, zIndex: 3 },
  ghostBtn: {
    width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 15,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#4A3E33',
  },
  ghostBtnLabel: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
});
