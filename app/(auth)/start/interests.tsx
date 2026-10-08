import React from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, UIFont } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { INTERESTS } from '@/core/constants/interests';
import { useSignupDraftStore } from '@/features/auth/presentation/store/signupDraft.store';
import { SignupStepShell } from '@/features/auth/presentation/components/SignupStepShell';
import { analytics } from '@/core/utils/analytics';

// Cycled per-chip accent, purely decorative — same palette as (app)/onboarding.tsx.
const INTEREST_DOTS = ['#8A6A4F', '#4A7C59', '#4A6B8A', '#8A4A6B', '#6B7A3A'];

const MIN_INTERESTS = 3;

export default function InterestsStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useTranslation();
  const draft = useSignupDraftStore((s) => s.draft);
  const update = useSignupDraftStore((s) => s.update);

  const toggle = (key: string) => {
    const next = draft.interests.includes(key)
      ? draft.interests.filter((i) => i !== key)
      : [...draft.interests, key];
    update({ interests: next });
  };

  const isValid = draft.interests.length >= MIN_INTERESTS;

  const handleContinue = () => {
    if (!isValid) return;
    analytics.track('onboarding_step_completed', { step: 'interests', count: draft.interests.length });
    router.push('/(auth)/start/personalise' as any);
  };

  return (
    <SignupStepShell
      title={t.onboardingInterestsTitle}
      subtitle={t.onboardingInterestsSub}
      ctaLabel={t.startContinueBtn}
      onCta={handleContinue}
      ctaDisabled={!isValid}
    >
      <View style={styles.grid}>
        {INTERESTS.map(({ key, tKey }, i) => {
          const selected = draft.interests.includes(key);
          return (
            <AnimatedPressable
              key={key}
              onPress={() => toggle(key)}
              style={[
                styles.chip,
                { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.primary : colors.border },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: INTEREST_DOTS[i % INTEREST_DOTS.length] }]} />
              <Text style={[styles.label, { color: selected ? colors.accentInk : colors.textPrimary }]}>
                {t[tKey as keyof typeof t] as string}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </SignupStepShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: BorderRadius.full, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, fontFamily: UIFont },
});
