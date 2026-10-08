import React from 'react';
import { useRouter } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/core/i18n';
import { validateName } from '@/core/utils/validators';
import { useSignupDraftStore } from '@/features/auth/presentation/store/signupDraft.store';
import { SignupStepShell } from '@/features/auth/presentation/components/SignupStepShell';
import { analytics } from '@/core/utils/analytics';

export default function NameStep() {
  const router = useRouter();
  const t = useTranslation();
  const draft = useSignupDraftStore((s) => s.draft);
  const update = useSignupDraftStore((s) => s.update);

  const isValid = validateName(draft.name).isValid;

  const handleContinue = () => {
    if (!isValid) return;
    analytics.track('onboarding_step_completed', { step: 'name' });
    router.push('/(auth)/start/age' as any);
  };

  return (
    <SignupStepShell
      title={t.startNameTitle}
      subtitle={t.startNameSubtitle}
      ctaLabel={t.startContinueBtn}
      onCta={handleContinue}
      ctaDisabled={!isValid}
    >
      <Input
        label={t.authNameLabel}
        value={draft.name}
        onChangeText={(v) => update({ name: v })}
        placeholder="Alexandros Tampakis"
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="done"
        onSubmitEditing={handleContinue}
      />
    </SignupStepShell>
  );
}
