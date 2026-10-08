import React from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { pickImage } from '@/core/utils/imagePicker';
import { isKnownUniversity, universityLabel } from '@/core/constants/universities';
import { useSignupDraftStore } from '@/features/auth/presentation/store/signupDraft.store';
import { SignupStepShell } from '@/features/auth/presentation/components/SignupStepShell';
import { analytics } from '@/core/utils/analytics';

const AVATAR_COLORS = [
  '#B8482A', '#7E52A8', '#3F7A55', '#3A6494',
  '#B2537A', '#A0702C', '#0891B2', '#DC2626',
  '#7C3AED', '#059669', '#D97706', '#DB2777',
];

export default function PersonaliseStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const draft = useSignupDraftStore((s) => s.draft);
  const update = useSignupDraftStore((s) => s.update);

  const initials = draft.name.split(' ').map((n) => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?';
  // A curated university's stable Greek identifier is translated for display
  // (matches the picker); an "Other" one is whatever the person typed, shown as-is.
  const universityDisplay = draft.universityName && isKnownUniversity(draft.universityName)
    ? universityLabel(draft.universityName, language)
    : draft.universityName;
  const subline = [draft.department, universityDisplay].filter(Boolean).join(' · ');

  const pickPhoto = async () => {
    const uri = await pickImage({ aspect: [1, 1] });
    if (uri) update({ photoUri: uri });
  };

  const handleContinue = () => {
    analytics.track('onboarding_step_completed', { step: 'personalise', hasPhoto: !!draft.photoUri, bioLength: draft.bio.length });
    router.push('/(auth)/start/account' as any);
  };

  return (
    <SignupStepShell
      title={t.onboardingPersonaliseTitle}
      subtitle={t.onboardingPersonaliseSub}
      ctaLabel={t.startContinueBtn}
      onCta={handleContinue}
    >
      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: draft.avatarColor }]}>
            {draft.photoUri ? (
              <Image source={{ uri: draft.photoUri }} style={styles.avatarPhoto} />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>
          {!!draft.photoUri && (
            <AnimatedPressable
              onPress={() => update({ photoUri: undefined })}
              style={[styles.removePhotoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              hitSlop={6}
            >
              <Icon name="x" size={12} color={colors.textPrimary} />
            </AnimatedPressable>
          )}
        </View>
        <View style={styles.avatarInfo}>
          <Text style={[styles.avatarName, { color: colors.textPrimary }]} numberOfLines={1}>{draft.name}</Text>
          {!!subline && <Text style={[styles.avatarSub, { color: colors.textHint }]} numberOfLines={1}>{subline}</Text>}
        </View>
        <Button label={t.startPersonalisePhotoBtn} onPress={pickPhoto} variant="outline" size="sm" />
      </View>

      {!draft.photoUri && (
        <>
          <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.onboardingPickColor}</Text>
          <View style={styles.colorGrid}>
            {AVATAR_COLORS.map((c) => (
              <AnimatedPressable
                key={c}
                onPress={() => update({ avatarColor: c })}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  draft.avatarColor === c && { borderWidth: 3, borderColor: colors.surface, transform: [{ scale: 1.15 }] },
                ]}
              />
            ))}
          </View>
        </>
      )}

      <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.onboardingBioLabel}</Text>
      <TextInput
        style={[styles.bioInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
        placeholder={t.onboardingBioPlaceholder()}
        placeholderTextColor={colors.textHint}
        value={draft.bio}
        onChangeText={(v) => update({ bio: v })}
        multiline
        numberOfLines={3}
        maxLength={160}
      />
      <Text style={[styles.charCount, { color: colors.textHint }]}>{draft.bio.length}/160</Text>
    </SignupStepShell>
  );
}

const styles = StyleSheet.create({
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarWrap: { width: 68, height: 68 },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  removePhotoBtn: {
    position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarInitials: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: UIFont },
  avatarInfo: { flex: 1, gap: 2 },
  avatarName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  avatarSub: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  bioInput: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, fontSize: FontSize.base, fontFamily: UIFontLight, minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: FontSize.xs, textAlign: 'right' },
});
