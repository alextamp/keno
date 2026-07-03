import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/core/theme';
import { BorderRadius } from '@/core/constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = BorderRadius.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: colors.surfaceVariant, opacity: anim },
        style,
      ]}
    />
  );
}

export function EventCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
      <View style={styles.topBar}>
        <Skeleton height={6} borderRadius={0} />
      </View>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Skeleton width={70} height={22} borderRadius={99} />
          <Skeleton width={60} height={22} borderRadius={99} />
        </View>
        <Skeleton height={20} borderRadius={4} />
        <Skeleton width="65%" height={20} borderRadius={4} />
        <Skeleton width="80%" height={14} borderRadius={4} />
        <View style={styles.footer}>
          <Skeleton height={6} borderRadius={3} style={{ flex: 1 }} />
          <Skeleton width={60} height={12} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 2.5, overflow: 'hidden' },
  topBar: { height: 6 },
  body: { padding: 14, gap: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
});
