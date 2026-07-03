import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight } from '@/core/constants/theme';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  /** Right-side content (e.g. a report icon). Omit for a symmetric spacer
   *  so the title stays visually centered. */
  right?: React.ReactNode;
  titleStyle?: TextStyle;
}

// Standard "back circle + title" row used across most secondary screens —
// extracted so the back button and title no longer drift screen-to-screen.
export function ScreenHeader({ title, onBack, right, titleStyle }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.9);

  return (
    <View style={styles.row}>
      <AnimatedPressable
        onPress={onBack ?? (() => router.back())}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.backBtn, { borderColor: colors.borderStrong }, animatedStyle]}
      >
        <Text style={[styles.backIcon, { color: colors.textPrimary }]}>←</Text>
      </AnimatedPressable>
      <Text style={[styles.title, { color: colors.textPrimary }, titleStyle]} numberOfLines={1}>
        {title}
      </Text>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  title: { flex: 1, fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  spacer: { width: 38 },
});
