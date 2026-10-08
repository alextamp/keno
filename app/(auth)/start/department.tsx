import React, { useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/core/i18n';
import { DEPARTMENTS_BY_UNIVERSITY } from '@/core/constants/departments';
import { useSignupDraftStore } from '@/features/auth/presentation/store/signupDraft.store';
import { SignupStepShell } from '@/features/auth/presentation/components/SignupStepShell';
import { analytics } from '@/core/utils/analytics';

export default function DepartmentStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useTranslation();
  const draft = useSignupDraftStore((s) => s.draft);
  const update = useSignupDraftStore((s) => s.update);

  const options = DEPARTMENTS_BY_UNIVERSITY[draft.universityName] ?? [];
  const hasOptions = options.length > 0;
  const [manualEntry, setManualEntry] = useState(!hasOptions);

  const selected = draft.department;

  const handleContinue = () => {
    analytics.track('onboarding_step_completed', { step: 'department' });
    router.push('/(auth)/start/name' as any);
  };

  if (hasOptions && !manualEntry) {
    // Collapse to just the picked row once selected — same interaction as
    // the university step, and here it matters even more since these lists
    // run 8-30 rows long.
    const visible = selected && options.includes(selected) ? options.filter((d) => d === selected) : options;
    return (
      <SignupStepShell
        title={t.startDepartmentTitle}
        subtitle={t.startDepartmentSubtitle}
        ctaLabel={t.startContinueBtn}
        onCta={handleContinue}
      >
        <View style={{ gap: Spacing.sm }}>
          {visible.map((d) => {
            const isSel = selected === d;
            return (
              <AnimatedPressable
                key={d}
                onPress={() => update({ department: isSel ? '' : d })}
                style={[
                  styles.row,
                  { backgroundColor: isSel ? colors.accentSoft : colors.surface, borderColor: isSel ? colors.primary : colors.border },
                ]}
              >
                <Text style={[styles.rowLabel, { color: isSel ? colors.accentInk : colors.textPrimary }]}>{d}</Text>
                {isSel && <Icon name="check" size={18} color={colors.primary} />}
              </AnimatedPressable>
            );
          })}
        </View>
        <AnimatedPressable onPress={() => setManualEntry(true)} style={styles.toggleLink}>
          <Text style={[styles.toggleLinkText, { color: colors.primary }]}>{t.startDepartmentManualLink}</Text>
        </AnimatedPressable>
      </SignupStepShell>
    );
  }

  return (
    <SignupStepShell
      title={t.startDepartmentTitle}
      subtitle={t.startDepartmentSubtitle}
      ctaLabel={t.startContinueBtn}
      onCta={handleContinue}
    >
      <Input
        label={`${t.authDeptLabel} (optional)`}
        value={draft.department}
        onChangeText={(v) => update({ department: v })}
        placeholder="Computer Science"
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={handleContinue}
      />
      {hasOptions && (
        <AnimatedPressable onPress={() => setManualEntry(false)} style={styles.toggleLink}>
          <Text style={[styles.toggleLinkText, { color: colors.primary }]}>{t.startDepartmentPickLink}</Text>
        </AnimatedPressable>
      )}
    </SignupStepShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    minHeight: 48, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  rowLabel: { flex: 1, fontSize: FontSize.lg, fontFamily: UIFontLight },
  toggleLink: { alignSelf: 'flex-start', paddingVertical: 2 },
  toggleLinkText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
});
