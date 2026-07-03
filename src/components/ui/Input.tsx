import React, { forwardRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/core/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, hint, containerStyle, style, secureTextEntry, ...props }, ref) => {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);

    const isPassword = secureTextEntry === true;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>}
        <View style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : focused ? colors.primary : colors.borderStrong,
          },
        ]}>
          <TextInput
            ref={ref}
            style={[styles.input, { color: colors.textPrimary, flex: 1 }, style]}
            placeholderTextColor={colors.textHint}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            secureTextEntry={isPassword ? hidden : false}
            {...props}
          />
          {isPassword && (
            <AnimatedPressable onPress={() => setHidden((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Text style={styles.eyeIcon}>{hidden ? '👁' : '🙈'}</Text>
            </AnimatedPressable>
          )}
        </View>
        {error ? (
          <Text style={[styles.hint, { color: colors.error }]}>{error}</Text>
        ) : hint ? (
          <Text style={[styles.hint, { color: colors.textHint }]}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 2.5,
    minHeight: 50,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base,
  },
  eyeBtn: { paddingHorizontal: Spacing.md },
  eyeIcon: { fontSize: 18 },
  hint: { fontSize: FontSize.xs },
});
