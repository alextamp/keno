import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { BeaconEntity } from '@/features/beacons/beacon.entity';

export function remainingLabel(expiresAt: Date, now: number): string {
  const ms = Math.max(0, expiresAt.getTime() - now);
  const totalSec = Math.floor(ms / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

interface Props {
  beacon: BeaconEntity;
  isOwn: boolean;
  distanceM: number;
  creatorName: string;
  creatorAvatarColor?: string;
  creatorPhotoUri?: string;
  onPress: () => void;
}

// The one deliberately "loud" card in the feed — a dashed border plus a
// continuous soft glow + subtle wiggle (Reanimated loops, not a static
// style) signals "temporary, act now" the way nothing else in the Warm
// Paper system does. Mirrors the mockup canvas's CSS beaconGlow/beaconWiggle
// keyframes, translated to RN's animation primitives.
export function BeaconCard({ beacon, isOwn, distanceM, creatorName, creatorAvatarColor, creatorPhotoUri, onPress }: Props) {
  const { colors } = useTheme();
  const t = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const glow = useSharedValue(0);
  const wiggle = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
    wiggle.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 5600 }),
        withTiming(-1, { duration: 90 }),
        withTiming(1, { duration: 90 }),
        withTiming(-0.6, { duration: 90 }),
        withTiming(0, { duration: 90 }),
      ),
      -1,
      false,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.18 + glow.value * 0.3 }));
  const wiggleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.value}deg` }] }));

  const initial = (creatorName?.[0] ?? '?').toUpperCase();

  return (
    <Animated.View style={wiggleStyle}>
      <AnimatedPressable onPress={onPress} scaleTo={0.98}>
        <View style={[styles.card, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
          <Animated.View pointerEvents="none" style={[styles.glowRing, { borderColor: colors.primary }, glowStyle]} />

          <View style={[styles.countdown, { backgroundColor: colors.textPrimary }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
            <Text style={styles.countdownText}>{remainingLabel(beacon.expiresAt, now)}</Text>
          </View>

          <View style={styles.row}>
            {creatorPhotoUri ? (
              <Image source={{ uri: creatorPhotoUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: creatorAvatarColor ?? colors.primary }]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {isOwn ? t.beaconActiveTitle : t.beaconCardTitle(creatorName)}
              </Text>
              <Text style={[styles.subtitle, { color: colors.accentInk }]} numberOfLines={1}>
                {beacon.note || t.beaconCardSubtitle}
              </Text>
              <Text style={[styles.meta, { color: colors.textHint }]}>
                {t.beaconDistanceLabel(Math.round(distanceM))} · {isOwn ? t.beaconSeenCount(beacon.seenByUids?.length ?? 0) : t.beaconCardSubtitle}
              </Text>
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, borderWidth: 1.5, borderStyle: 'dashed', padding: Spacing.md, overflow: 'hidden' },
  glowRing: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: BorderRadius.lg + 3, borderWidth: 3 },
  countdown: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: BorderRadius.full, paddingHorizontal: 9, paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  countdownText: { color: '#fff', fontSize: 10.5, fontWeight: FontWeight.bold, fontFamily: UIFont },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  info: { flex: 1, minWidth: 0, paddingRight: 56, gap: 2 },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  subtitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: UIFont },
  meta: { fontSize: FontSize.xs, fontFamily: UIFontLight },
});
