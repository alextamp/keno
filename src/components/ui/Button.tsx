import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/core/theme';
import { BorderRadius, DrawFont, FontSize, FontWeight, Shadow, Spacing } from '@/core/constants/theme';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  /** 'rounded' (default) for standard CTAs, 'pill' for fully-rounded action
   *  chips (Follow, Join/Leave), 'circle' for a fixed-size icon-only button
   *  (chat Send). */
  shape?: 'rounded' | 'pill' | 'circle';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

const SIZE_STYLES: Record<string, ViewStyle> = {
  sm: { paddingHorizontal: Spacing.md, paddingVertical: 6, minHeight: 36 },
  md: { paddingHorizontal: Spacing.lg, paddingVertical: 12, minHeight: 50 },
  lg: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, minHeight: 58 },
};

const CIRCLE_DIAMETERS: Record<string, number> = { sm: 36, md: 44, lg: 52 };

const LABEL_SIZES: Record<string, TextStyle> = {
  sm: { fontSize: FontSize.sm },
  md: { fontSize: FontSize.base },
  lg: { fontSize: FontSize.lg },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  labelStyle,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.95);

  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: colors.primary, borderColor: colors.borderStrong, borderWidth: 2.5 }
      : variant === 'outline'
      ? { backgroundColor: 'transparent', borderColor: colors.borderStrong, borderWidth: 2.5 }
      : { backgroundColor: 'transparent' };

  const labelColor = variant === 'primary' ? '#FFFFFF' : colors.primary;

  const shapeStyle: ViewStyle =
    shape === 'pill'
      ? { borderRadius: BorderRadius.full }
      : shape === 'circle'
      ? { borderRadius: BorderRadius.full, width: CIRCLE_DIAMETERS[size], height: CIRCLE_DIAMETERS[size], paddingHorizontal: 0, paddingVertical: 0, minHeight: undefined }
      : {};

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={isDisabled ? undefined : onPressIn}
      onPressOut={isDisabled ? undefined : onPressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyle,
        SIZE_STYLES[size],
        shapeStyle,
        fullWidth && styles.fullWidth,
        variant !== 'ghost' && (Shadow.sm as ViewStyle),
        isDisabled && styles.pressed,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }, LABEL_SIZES[size], labelStyle]}>
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  fullWidth: { width: '100%' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  label: { fontWeight: FontWeight.bold, fontFamily: DrawFont },
});
