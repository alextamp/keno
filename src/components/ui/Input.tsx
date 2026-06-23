import React, { forwardRef, useState } from 'react';
import {
  StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
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
  ({ label, error, hint, containerStyle, style, ...props }, ref) => {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              backgroundColor: focused ? colors.surface : colors.surfaceVariant,
              color: colors.textPrimary,
              borderColor: focused ? colors.primary : error ? colors.error : 'transparent',
            },
            style,
          ]}
          placeholderTextColor={colors.textHint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
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
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.1,
  },
  input: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base,
    minHeight: 48,
    borderWidth: 1.5,
  },
  hint: { fontSize: FontSize.xs },
});
