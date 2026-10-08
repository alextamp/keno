import React, { forwardRef } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme';
import { Button } from '@/components/ui/Button';
import { TitleFont, UIFontLight, FontSize, FontWeight, Spacing } from '@/core/constants/theme';

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

// Shared chrome for every app/(auth)/start/* step — title/subtitle/body up
// top, a sticky footer with the primary CTA and an optional secondary text
// action below it. The header (back chevron + progress bar) lives one level
// up in start/_layout.tsx since it's shared across route transitions.
//
// Forwards its ScrollView ref so a screen can scroll itself back to the top
// when tapping the footer CTA reveals new content further up the form (e.g.
// account.tsx's un-recognised-email banner) — otherwise, if the person was
// scrolled down near the button, the change is invisible and looks like the
// tap did nothing.
export const SignupStepShell = forwardRef<ScrollView, Props>(function SignupStepShell({
  title, subtitle, children, ctaLabel, onCta, ctaDisabled, ctaLoading, secondaryLabel, onSecondary,
}, ref) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={ref}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textHint }]}>{subtitle}</Text>
        <View style={styles.content}>{children}</View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.gutter, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Button label={ctaLabel} onPress={onCta} disabled={ctaDisabled} loading={ctaLoading} size="lg" fullWidth />
        {secondaryLabel && (
          <AnimatedPressable onPress={onSecondary} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryText, { color: colors.textHint }]}>{secondaryLabel}</Text>
          </AnimatedPressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flexGrow: 1, paddingTop: 12, paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.xl },
  title: { fontFamily: TitleFont, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, letterSpacing: -0.4 },
  subtitle: { fontFamily: UIFontLight, fontSize: FontSize.base, lineHeight: 21, marginTop: 6 },
  content: { marginTop: Spacing.base, gap: Spacing.base },
  footer: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.gutter, borderTopWidth: 1, gap: Spacing.sm },
  secondaryBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: FontSize.base },
});
