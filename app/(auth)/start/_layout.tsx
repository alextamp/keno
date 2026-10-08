import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme';
import { BorderRadius, Spacing } from '@/core/constants/theme';
import { Icon } from '@/components/ui/Icon';
import {
  useSignupDraftStore, STEP_ORDER, STEP_PROGRESS, isStepAllowed, firstIncompleteStep, SignupStep,
} from '@/features/auth/presentation/store/signupDraft.store';

const ALL_STEPS: readonly string[] = STEP_ORDER;

export default function StartLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const draft = useSignupDraftStore((s) => s.draft);
  const hydrated = useSignupDraftStore((s) => s.hydrated);
  const hydrate = useSignupDraftStore((s) => s.hydrate);

  useEffect(() => { hydrate(); }, [hydrate]);

  const lastSegment = segments[segments.length - 1];
  const currentStep: SignupStep | null = lastSegment && ALL_STEPS.includes(lastSegment) ? (lastSegment as SignupStep) : null;

  // Guards against a killed app resuming mid-flow, a stale stack, or a deep
  // link dropping someone straight onto e.g. `account` with an empty draft —
  // in every case, bounce back to the first step whose required data is
  // still missing rather than letting a later step read from nothing.
  useEffect(() => {
    if (!hydrated || !currentStep) return;
    if (!isStepAllowed(currentStep, draft)) {
      const target = firstIncompleteStep(draft) ?? 'university';
      router.replace(`/(auth)/start/${target}` as any);
    }
  }, [hydrated, currentStep, draft, router]);

  const progress = currentStep ? STEP_PROGRESS[currentStep] : STEP_PROGRESS.university;
  const fillWidth = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(fillWidth, { toValue: progress, duration: 280, useNativeDriver: false }).start();
  }, [progress, fillWidth]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: Spacing.gutter }]}>
        <AnimatedPressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome' as any))}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Icon name="back" size={18} color={colors.textPrimary} />
        </AnimatedPressable>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: colors.primary,
                width: fillWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
        <View style={styles.spacer} pointerEvents="none" />
      </View>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 44, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 36, height: 36 },
  track: { flex: 1, height: 4, borderRadius: BorderRadius.full, overflow: 'hidden' },
  fill: { height: 4, borderRadius: BorderRadius.full },
});
