import React from 'react';
import { useRouter } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/core/i18n';
import { validateAge } from '@/core/utils/validators';
import { useSignupDraftStore } from '@/features/auth/presentation/store/signupDraft.store';
import { SignupStepShell } from '@/features/auth/presentation/components/SignupStepShell';
import { analytics } from '@/core/utils/analytics';

export default function AgeStep() {
  const router = useRouter();
  const t = useTranslation();
  const draft = useSignupDraftStore((s) => s.draft);
  const update = useSignupDraftStore((s) => s.update);

  // Optional, same as department — an empty field just continues, no
  // separate skip action needed.
  const isValid = !draft.age.trim() || validateAge(draft.age).isValid;

  const handleContinue = () => {
    if (!isValid) return;
    analytics.track('onboarding_step_completed', { step: 'age' });
    router.push('/(auth)/start/interests' as any);
  };

  return (
    <SignupStepShell
      title={t.startAgeTitle}
      subtitle={t.startAgeSubtitle}
      ctaLabel={t.startContinueBtn}
      onCta={handleContinue}
      ctaDisabled={!isValid}
    >
      <Input
        label={t.authAgeLabel}
        value={draft.age}
        onChangeText={(v) => update({ age: v.replace(/[^0-9]/g, '') })}
        placeholder="20"
        keyboardType="number-pad"
        returnKeyType="done"
        onSubmitEditing={handleContinue}
      />
    </SignupStepShell>
  );
}
