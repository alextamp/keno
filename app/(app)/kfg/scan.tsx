import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AccentScopeProvider, LightColors, useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { sounds } from '@/core/utils/sounds';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgParticipation } from '@/features/kfg/domain/entities/kfg.entity';

// The organizer/partner side of QR verification: scan participants' rotating
// codes one after another (first scan = check-in, second = check-out). Same
// camera pattern as the event check-in scanner, but the camera stays open.

const SAME_CODE_COOLDOWN_MS = 4000;

export default function KfgScanScreen() {
  return (
    <AccentScopeProvider value="kfg">
      <ScanInner />
    </AccentScopeProvider>
  );
}

function ScanInner() {
  const { missionId } = useLocalSearchParams<{ missionId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [participations, setParticipations] = useState<KfgParticipation[]>([]);
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  useEffect(() => {
    if (!missionId || !user) return;
    return kfgRepository.subscribeMissionParticipations(missionId, user.id, setParticipations);
  }, [missionId, user?.id]);

  const onCode = async ({ data }: { data: string }) => {
    if (busy || !data.startsWith('kfg:')) return;
    const now = Date.now();
    if (lastScan.current && lastScan.current.code === data && now - lastScan.current.at < SAME_CODE_COOLDOWN_MS) return;
    lastScan.current = { code: data, at: now };
    setBusy(true);
    const r = await kfgRepository.scan(data);
    setBusy(false);
    if (isLeft(r)) {
      haptics.error();
      setResult({ text: t.kfgError(r.left.message), ok: false });
      return;
    }
    const res = r.right;
    const ok = res.result !== 'tooEarly';
    if (ok) { haptics.success(); sounds.play('success'); } else haptics.light();
    setResult({ text: t.kfgScanResult(res.result, res.name, res.result === 'tooEarly' ? res.remainingMin : undefined), ok });
  };

  const checkOutAll = () => Alert.alert(t.kfgCheckOutAllBtn, t.kfgCheckOutAllConfirm, [
    { text: t.settingsBtnCancel, style: 'cancel' },
    {
      text: t.kfgCheckOutAllBtn,
      onPress: async () => {
        const r = await kfgRepository.checkOutAll(missionId!);
        if (isLeft(r)) { Alert.alert(t.kfgCheckOutAllBtn, t.kfgError(r.left.message)); return; }
        Alert.alert(t.kfgCheckOutAllBtn, t.kfgCheckOutAllResult(r.right.completed, r.right.tooEarly));
      },
    },
  ]);

  const present = participations.filter((p) => p.status === 'checkedIn').length;
  const done = participations.filter((p) => p.status === 'completed' || p.status === 'verified').length;

  return (
    <View style={styles.root}>
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={busy ? undefined : onCode}
        />
      ) : (
        <View style={styles.gate}>
          <Icon name="camera" size={40} color={LightColors.white} />
          <Text style={styles.gateText}>{t.kfgCameraNeeded}</Text>
          <Button label={t.kfgCameraAllow} onPress={requestPermission} />
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <AnimatedPressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.settingsBtnCancel} style={styles.iconBtn}>
          <Icon name="x" size={20} color={LightColors.white} />
        </AnimatedPressable>
        <Text style={styles.topTitle}>{t.kfgScanTitle}</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={[styles.frame, { borderColor: colors.kfgAccentLight }]} />
        <Text style={styles.hint}>{t.kfgScanHint}</Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        {busy ? (
          <ActivityIndicator color={LightColors.white} />
        ) : result ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.result, { backgroundColor: result.ok ? colors.primary : colors.surface }]}
          >
            <Icon name={result.ok ? 'check' : 'alert'} size={18} color={result.ok ? LightColors.white : colors.textPrimary} />
            <Text style={[styles.resultText, { color: result.ok ? LightColors.white : colors.textPrimary }]}>{result.text}</Text>
          </View>
        ) : null}
        <Text style={styles.stats}>{t.kfgScanStats(present, done)}</Text>
        <Button label={t.kfgCheckOutAllBtn} variant="soft" onPress={checkOutAll} disabled={present === 0} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LightColors.black },
  gate: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.gutter },
  gateText: { color: LightColors.white, fontFamily: UIFont, fontSize: FontSize.lg, textAlign: 'center' },
  top: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: Spacing.gutter,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: LightColors.white, fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: Spacing.base },
  frame: { width: 230, height: 230, borderRadius: BorderRadius.lg, borderWidth: 3 },
  hint: { color: LightColors.white, fontFamily: UIFontLight, fontSize: FontSize.md, textAlign: 'center', paddingHorizontal: Spacing.xl },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.gutter, gap: Spacing.md, alignItems: 'center' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, alignSelf: 'stretch' },
  resultText: { flex: 1, fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  stats: { color: LightColors.white, fontFamily: UIFont, fontSize: FontSize.md },
});
