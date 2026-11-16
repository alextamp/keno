import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, FlatList, NativeScrollEvent, NativeSyntheticEvent, PixelRatio, Platform, Share, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
// SDK 58: the package root's saveToLibraryAsync/requestPermissionsAsync now
// throw at runtime (new Asset API); the unchanged API lives under /legacy.
import * as MediaLibrary from 'expo-media-library/legacy';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { KFG_SLIDE_COMPONENTS, KFG_SLIDES, SLIDE_H, SLIDE_W } from '@/components/kfg/KfgWrappedSlides';
import { FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { getDateLocale, useLanguageStore, useTranslation } from '@/core/i18n';
import { haptics } from '@/core/utils/haptics';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { completedParticipations } from '@/features/kfg/tickets';
import { computeKfgWrapped, KFG_WRAPPED_MIN } from '@/features/kfg/wrapped';

// Keno for Good Wrapped — same story viewer as app/(app)/wrapped.tsx
// (swipe, share, save at 1080×1920), with the KfG slides.

const HEADER_H = 56;
const FOOTER_H = 92;
const GREEN = '#3F7A55';

const EXPORT = Platform.select({
  ios: { width: SLIDE_W / PixelRatio.get(), height: SLIDE_H / PixelRatio.get() },
  default: { width: SLIDE_W, height: SLIDE_H },
});

export default function KfgWrappedScreen() {
  return (
    <AccentScopeProvider value="kfg">
      <WrappedInner />
    </AccentScopeProvider>
  );
}

function WrappedInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const { profile, participations, loaded, start, stop } = useKfgStore();

  const [missions, setMissions] = useState<KfgMission[] | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const slideRefs = useRef<Record<number, React.ComponentRef<typeof View> | null>>({});

  useEffect(() => {
    if (!user) return;
    start(user.id);
    return stop;
  }, [user?.id]);

  const doneIds = completedParticipations(participations).map((p) => p.missionId).sort().join(',');
  useEffect(() => {
    if (!loaded || !doneIds) return;
    kfgRepository.getMissions(doneIds.split(',')).then(setMissions);
  }, [loaded, doneIds]);

  // Nothing completed yet → no fetch needed, stats are simply empty.
  const fetched = loaded && !doneIds ? [] : missions;
  const stats = useMemo(() => (fetched ? computeKfgWrapped(participations, fetched) : null), [participations, fetched]);

  // Printed on the receipt only, and only ever as "First L." — never a full name.
  const shortName = useMemo(() => {
    const parts = (user?.name ?? '').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? '';
  }, [user?.name]);

  const available = height - insets.top - insets.bottom - HEADER_H - FOOTER_H - Spacing.md * 2;
  const s = Math.min((width - Spacing.gutter * 2) / SLIDE_W, available / SLIDE_H);

  const capture = async () => {
    const node = slideRefs.current[index];
    if (!node) return null;
    return captureRef(node, { format: 'png', quality: 1, ...EXPORT });
  };

  const handleShare = async () => {
    if (busy) return;
    haptics.light();
    setBusy(true);
    try {
      const uri = await capture();
      if (uri) await Share.share({ url: uri, title: 'Keno for Good Wrapped' });
    } catch {}
    setBusy(false);
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert(t.createAlertSaveError, t.eventPhotoSavePermissionDenied);
      } else {
        const uri = await capture();
        if (uri) {
          await MediaLibrary.saveToLibraryAsync(uri);
          haptics.success();
          Alert.alert(t.wrappedSaved);
        }
      }
    } catch {
      Alert.alert(t.createAlertSaveError, t.eventPhotoSaveError);
    }
    setBusy(false);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  if (!stats || !profile) return <LoadingScreen />;

  if (stats.missions < KFG_WRAPPED_MIN) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
          <Icon name="heart" size={34} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.kfgWrappedEmptyTitle}</Text>
        <Text style={[styles.emptyBody, { color: colors.textHint }]}>{t.kfgWrappedEmptyBody(KFG_WRAPPED_MIN - stats.missions)}</Text>
        <Button label={t.newcomerContinueBtn} onPress={() => router.back()} fullWidth />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { height: HEADER_H }]}>
        <View style={styles.progress}>
          {KFG_SLIDES.map((k, i) => (
            <View key={k} style={[styles.progressSeg, { backgroundColor: i <= index ? '#FAF7F2' : 'rgba(250,247,242,0.25)' }]} />
          ))}
        </View>
        <AnimatedPressable onPress={() => router.back()} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close">
          <Icon name="x" size={20} color="#FAF7F2" />
        </AnimatedPressable>
      </View>

      <FlatList
        data={KFG_SLIDES}
        keyExtractor={(k) => k}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item, index: i }) => {
          const Slide = KFG_SLIDE_COMPONENTS[item];
          return (
            <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ borderRadius: 18, overflow: 'hidden' }}>
                <View ref={(r) => { slideRefs.current[i] = r; }} collapsable={false}>
                  <Slide
                    stats={stats}
                    profile={profile}
                    s={s}
                    t={t}
                    language={language}
                    userName={shortName}
                    dateLocale={getDateLocale(language)}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.footer, { height: FOOTER_H }]}>
        <AnimatedPressable onPress={handleShare} disabled={busy} style={[styles.action, styles.actionPrimary]}>
          <Icon name="share" size={18} color="#FFFFFF" />
          <Text style={styles.actionPrimaryText}>{t.wrappedShare}</Text>
        </AnimatedPressable>
        <AnimatedPressable onPress={handleSave} disabled={busy} style={[styles.action, styles.actionGhost]}>
          <Icon name="image" size={18} color="#FAF7F2" />
          <Text style={styles.actionGhostText}>{t.wrappedSave}</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C140F' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.gutter, gap: Spacing.md },
  progress: { flex: 1, flexDirection: 'row', gap: 4 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,247,242,0.12)' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.gutter },
  action: { flex: 1, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionPrimary: { backgroundColor: GREEN },
  actionPrimaryText: { color: '#FFFFFF', fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  actionGhost: { borderWidth: 1.5, borderColor: 'rgba(250,247,242,0.35)' },
  actionGhostText: { color: '#FAF7F2', fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: TitleFont, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, textAlign: 'center' },
  emptyBody: { fontFamily: UIFontLight, fontSize: FontSize.base, lineHeight: 21, textAlign: 'center', marginBottom: Spacing.md },
});
