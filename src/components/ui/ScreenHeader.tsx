import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { TitleFont, FontSize, FontWeight } from '@/core/constants/theme';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { Icon } from './Icon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  /** Right-side content (e.g. a report icon). Omit for a symmetric spacer
   *  so the title stays visually centered. */
  right?: React.ReactNode;
  titleStyle?: TextStyle;
}

// Warm Paper header (mockup .circbtn): flat 32px circular back button, 1px
// border, line-icon chevron — used across most secondary/detail screens.
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
        style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }, animatedStyle]}
      >
        <Icon name="back" size={17} color={colors.textPrimary} />
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
  backBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.4 },
  spacer: { width: 32 },
});
