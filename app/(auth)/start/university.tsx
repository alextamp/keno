import React, { useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFontLight } from '@/core/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { UNIVERSITIES, UNIVERSITY_DOMAINS, universityLabel, isKnownUniversity } from '@/core/constants/universities';
import { useSignupDraftStore } from '@/features/auth/presentation/store/signupDraft.store';
import { SignupStepShell } from '@/features/auth/presentation/components/SignupStepShell';
import { analytics } from '@/core/utils/analytics';

function splitOnMarker(full: string, marker: string): { pre: string; bold: string; post: string } {
  const idx = full.indexOf(marker);
  return idx >= 0
    ? { pre: full.slice(0, idx), bold: marker, post: full.slice(idx + marker.length) }
    : { pre: full, bold: '', post: '' };
}

export default function UniversityStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const draft = useSignupDraftStore((s) => s.draft);
  const update = useSignupDraftStore((s) => s.update);

  const selected = draft.universityName;
  // "Other" is stored as whatever the person actually typed (a real value,
  // not a placeholder) — so it's only distinguishable from a curated pick by
  // not matching any of the 24 known universities.
  const [otherMode, setOtherMode] = useState(!!selected && !isKnownUniversity(selected));

  const domain = selected ? UNIVERSITY_DOMAINS[selected] : undefined;
  const expectation = domain ? splitOnMarker(t.startUniversityExpectation(domain), `@${domain}`) : null;

  const handleContinue = () => {
    analytics.track('onboarding_step_completed', { step: 'university' });
    router.push('/(auth)/start/department' as any);
  };

  const enterOtherMode = () => {
    setOtherMode(true);
    update({ universityName: '' });
  };

  const exitOtherMode = () => {
    setOtherMode(false);
    update({ universityName: '' });
  };

  if (otherMode) {
    return (
      <SignupStepShell
        title={t.startUniversityTitle}
        subtitle={t.startUniversitySubtitle}
        ctaLabel={t.startContinueBtn}
        onCta={handleContinue}
        ctaDisabled={!selected}
      >
        <Input
          label={t.authUniLabel}
          value={selected}
          onChangeText={(v) => update({ universityName: v })}
          placeholder="University of Nicosia"
          autoCapitalize="words"
          returnKeyType="done"
          autoFocus
        />
        <AnimatedPressable onPress={exitOtherMode} style={styles.toggleLink}>
          <Text style={[styles.toggleLinkText, { color: colors.primary }]}>{t.startDepartmentPickLink}</Text>
        </AnimatedPressable>

        <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
          <Icon name="shield" size={16} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.accentInk }]}>{t.startUniversityOtherNote}</Text>
        </View>
      </SignupStepShell>
    );
  }

  return (
    <SignupStepShell
      title={t.startUniversityTitle}
      subtitle={t.startUniversitySubtitle}
      ctaLabel={t.startContinueBtn}
      onCta={handleContinue}
      ctaDisabled={!selected}
    >
      <View style={{ gap: Spacing.sm }}>
        {(selected ? UNIVERSITIES.filter((u) => u.el === selected) : UNIVERSITIES).map((u) => {
          const isSel = selected === u.el;
          return (
            <AnimatedPressable
              key={u.el}
              // Tapping the already-selected row deselects it (bringing the
              // full list back) instead of being a no-op — otherwise, once
              // collapsed to one row, there'd be no way to change your mind
              // without leaving the screen.
              onPress={() => update({ universityName: isSel ? '' : u.el })}
              style={[
                styles.row,
                { backgroundColor: isSel ? colors.accentSoft : colors.surface, borderColor: isSel ? colors.primary : colors.border },
              ]}
            >
              <Text style={[styles.rowLabel, { color: isSel ? colors.accentInk : colors.textPrimary }]}>
                {universityLabel(u.el, language)}
              </Text>
              {isSel && <Icon name="check" size={18} color={colors.primary} />}
            </AnimatedPressable>
          );
        })}
        {!selected && (
          <AnimatedPressable
            onPress={enterOtherMode}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t.startUniversityOtherOption}</Text>
          </AnimatedPressable>
        )}
      </View>

      {expectation && (
        <>
          <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
            <Icon name="shield" size={16} color={colors.primary} />
            <Text style={[styles.noteText, { color: colors.accentInk }]}>
              {expectation.pre}
              {!!expectation.bold && <Text style={{ fontWeight: FontWeight.bold }}>{expectation.bold}</Text>}
              {expectation.post}
            </Text>
          </View>
          <View style={[styles.note, { backgroundColor: colors.surfaceVariant }]}>
            <Icon name="mail" size={16} color={colors.textSecondary} />
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>{t.startUniversityFallbackNote}</Text>
          </View>
        </>
      )}
    </SignupStepShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  rowLabel: { fontSize: FontSize.lg, fontFamily: UIFontLight },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: BorderRadius.md, padding: 14,
  },
  noteText: { flex: 1, fontSize: FontSize.md, lineHeight: 19 },
  toggleLink: { alignSelf: 'flex-start', paddingVertical: 2 },
  toggleLinkText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
