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
import { BorderRadius, UIFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary = accent fill; outline/ghost = 1px border, transparent;
   *  soft = accent.soft fill + accent.ink text (mockup .btn.gh2). */
  variant?: 'primary' | 'outline' | 'ghost' | 'soft';
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
  sm: { paddingHorizontal: Spacing.base, paddingVertical: 8, minHeight: 36 },
  md: { paddingHorizontal: Spacing.lg, paddingVertical: 13, minHeight: 46 },
  lg: { paddingHorizontal: Spacing.gutter, paddingVertical: 15, minHeight: 52 },
};

const CIRCLE_DIAMETERS: Record<string, number> = { sm: 34, md: 42, lg: 50 };

const LABEL_SIZES: Record<string, TextStyle> = {
  sm: { fontSize: 12.5 },
  md: { fontSize: FontSize.lg },
  lg: { fontSize: FontSize.xl },
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
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.97);

  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: colors.primary }
      : variant === 'soft'
      ? { backgroundColor: colors.accentSoft }
      : variant === 'outline'
      ? { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 }
      : { backgroundColor: 'transparent' };

  const labelColor =
    variant === 'primary' ? '#FFFFFF' : variant === 'soft' ? colors.accentInk : colors.primary;

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
        isDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <Text numberOfLines={1} style={[styles.label, { color: labelColor }, LABEL_SIZES[size], labelStyle]}>
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
  disabled: { opacity: 0.5 },
  label: { fontWeight: FontWeight.bold, fontFamily: UIFont },
});
