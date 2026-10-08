import React, { useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Alert, Animated, Dimensions, Image, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { pickImage } from '@/core/utils/imagePicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, LogoFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { INTERESTS } from '@/core/constants/interests';
import { uploadProfilePhoto } from '@/core/utils/uploadImage';
import { analytics } from '@/core/utils/analytics';
import { Icon, IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const { width: SW } = Dimensions.get('window');

const AVATAR_COLORS = [
  '#B8482A', '#7E52A8', '#3F7A55', '#3A6494',
  '#B2537A', '#A0702C', '#0891B2', '#DC2626',
  '#7C3AED', '#059669', '#D97706', '#DB2777',
];

// Cycled per-chip accent for the interest dots (spec §4 chip anatomy) — the
// dot colors are purely decorative variety, not tied to any data field.
const INTEREST_DOTS = ['#8A6A4F', '#4A7C59', '#4A6B8A', '#8A4A6B', '#6B7A3A'];

const FEATURE_ICONS: IconName[] = ['cal', 'users', 'map', 'bell'];

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const t = useTranslation();
  const { language } = useLanguageStore();

  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? '#B8482A');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [draftPhoto, setDraftPhoto] = useState<string | undefined>(user?.photoUri);
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const uri = await pickImage({ aspect: [1, 1] });
    if (uri) setDraftPhoto(uri);
  };

  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTo = (nextStep: number) => {
    const direction = nextStep > step ? 1 : -1;
    slideAnim.setValue(direction * SW);
    setStep(nextStep);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
  };

  const toggleInterest = (key: string) => {
    setSelectedInterests((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key],
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    let finalPhotoUri = draftPhoto;
    if (draftPhoto && !draftPhoto.startsWith('http') && user) {
      try {
        finalPhotoUri = await uploadProfilePhoto(user.id, draftPhoto);
      } catch {
        finalPhotoUri = user.photoUri;
      }
    }
    await completeOnboarding({ interests: selectedInterests, bio, avatarColor, photoUri: finalPhotoUri });
    analytics.track('onboarding_completed', { interestCount: selectedInterests.length, hasPhoto: !!finalPhotoUri });
    router.replace('/(app)');
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  const steps = [
    // Step 0: Welcome
    <View key="welcome" style={styles.stepContent}>
      <View style={[styles.mk, { backgroundColor: colors.primary }]}>
        <Text style={styles.mkLetter}>k.</Text>
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>
        {t.onboardingWelcome(user?.name?.split(' ')[0] ?? '')}
      </Text>
      <Text style={[styles.welcomeSub, { color: colors.textHint }]}>
        {t.onboardingWelcomeSub}
      </Text>
      <View style={styles.featureList}>
        {[t.onboardingFeature1, t.onboardingFeature2, t.onboardingFeature3, t.onboardingFeature4].map((text, i) => (
          <View key={text} style={styles.featureRow}>
            <Icon name={FEATURE_ICONS[i]} size={19} color={colors.textSecondary} />
            <Text style={[styles.featureText, { color: colors.textPrimary }]}>{text}</Text>
          </View>
        ))}
      </View>
    </View>,

    // Step 1: Interests
    <View key="interests" style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t.onboardingInterestsTitle}</Text>
      <Text style={[styles.stepSub, { color: colors.textHint }]}>
        {t.onboardingInterestsSub}
      </Text>
      <View style={styles.interestGrid}>
        {INTERESTS.map(({ key, tKey }, i) => {
          const selected = selectedInterests.includes(key);
          return (
            <AnimatedPressable
              key={key}
              onPress={() => toggleInterest(key)}
              style={[
                styles.interestChip,
                { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.primary : colors.border },
              ]}
            >
              <View style={[styles.interestDot, { backgroundColor: INTEREST_DOTS[i % INTEREST_DOTS.length] }]} />
              <Text style={[styles.interestLabel, { color: selected ? colors.accentInk : colors.textPrimary }]}>
                {t[tKey as keyof typeof t] as string}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>,

    // Step 2: Personalise
    <View key="personalise" style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t.onboardingPersonaliseTitle}</Text>
      <Text style={[styles.stepSub, { color: colors.textHint }]}>
        {t.onboardingPersonaliseSub}
      </Text>

      {/* Avatar preview */}
      <View style={styles.avatarPreviewRow}>
        <AnimatedPressable onPress={pickPhoto} style={[styles.avatarPreview, { backgroundColor: avatarColor }]}>
          {draftPhoto ? (
            <Image source={{ uri: draftPhoto }} style={styles.avatarPreviewPhoto} />
          ) : (
            <Text style={styles.avatarInitials}>{initials}</Text>
          )}
          <View style={styles.photoOverlay}>
            <Icon name="camera" size={13} color="#fff" />
          </View>
        </AnimatedPressable>
        <Text style={[styles.avatarName, { color: colors.textPrimary }]}>{user?.name}</Text>
      </View>

      {/* Colour picker */}
      <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.onboardingPickColor}</Text>
      <View style={styles.colorGrid}>
        {AVATAR_COLORS.map((c) => (
          <AnimatedPressable
            key={c}
            onPress={() => setAvatarColor(c)}
            style={[
              styles.colorDot,
              { backgroundColor: c },
              avatarColor === c && { borderWidth: 3, borderColor: colors.surface, transform: [{ scale: 1.15 }] },
            ]}
          />
        ))}
      </View>

      {/* Bio */}
      <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.onboardingBioLabel}</Text>
      <TextInput
        style={[styles.bioInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
        placeholder={t.onboardingBioPlaceholder()}
        placeholderTextColor={colors.textHint}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={3}
        maxLength={160}
      />
      <Text style={[styles.charCount, { color: colors.textHint }]}>{bio.length}/160</Text>
    </View>,

    // Step 3: All set
    <View key="done" style={styles.stepContent}>
      <View style={[styles.halo, { backgroundColor: colors.accentSoft }]}>
        <Icon name="check" size={34} color={colors.primary} strokeWidth={2.4} />
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>{t.onboardingDoneTitle}</Text>
      <Text style={[styles.welcomeSub, { color: colors.textHint }]}>
        {t.onboardingDoneSub}
      </Text>
      <Card padded style={styles.summaryCard}>
        <View style={[styles.summaryAvatar, { backgroundColor: avatarColor }]}>
          {draftPhoto ? (
            <Image source={{ uri: draftPhoto }} style={styles.summaryAvatarPhoto} />
          ) : (
            <Text style={styles.summaryInitials}>{initials}</Text>
          )}
        </View>
        <View style={styles.summaryInfo}>
          <Text style={[styles.summaryName, { color: colors.textPrimary }]}>{user?.name}</Text>
          <Text style={[styles.summaryUni, { color: colors.textHint }]}>
            {universityLabel(user?.universityName ?? '', language)}
          </Text>
          {selectedInterests.length > 0 && (
            <Text style={[styles.summaryInterests, { color: colors.textHint }]} numberOfLines={1}>
              {selectedInterests.slice(0, 5).map((key) => {
                const item = INTERESTS.find((i) => i.key === key);
                return item ? t[item.tKey as keyof typeof t] as string : key;
              }).join(' · ')}
            </Text>
          )}
        </View>
      </Card>
    </View>,
  ];

  const canAdvance = [
    true,                               // welcome: always
    selectedInterests.length >= 3,      // interests: need 3+
    true,                               // personalise: always (bio optional)
    true,                               // done: always
  ][step];

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Progress dots */}
      <View style={[styles.progressRow, { paddingTop: insets.top + 16 }]}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i <= step ? colors.primary : colors.border,
                width: i === step ? 17 : 6,
              },
            ]}
          />
        ))}
      </View>

      {/* Step content */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          {steps[step]}
        </Animated.View>
      </ScrollView>

      {/* CTA footer — the interests step (mockup 03) replaces the usual
          back/continue pair with a "N επιλεγμένα" counter + continue row. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {step === 1 ? (
          <View style={styles.interestsFooterRow}>
            <Text style={[styles.interestsCount, { color: colors.textHint }]}>
              {t.onboardingInterestsCount(selectedInterests.length)}
            </Text>
            <Button
              label={t.onboardingBtnContinue}
              onPress={() => animateTo(step + 1)}
              disabled={!canAdvance}
            />
          </View>
        ) : (
          <>
            {step > 0 && (
              <Button label={t.onboardingBtnBack} variant="outline" onPress={() => animateTo(step - 1)} />
            )}
            <Button
              label={saving ? t.onboardingBtnSaving : isLast ? t.onboardingBtnFinish : step === 0 ? t.onboardingBtnGetStarted : t.onboardingBtnContinue}
              onPress={isLast ? handleFinish : () => animateTo(step + 1)}
              disabled={!canAdvance || saving}
              loading={saving}
              fullWidth={step === 0}
              style={step > 0 ? { flex: 1 } : undefined}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingBottom: 8,
  },
  dot: { height: 6, borderRadius: 3 },
  scrollContent: { padding: Spacing.gutter },
  stepContent: { gap: Spacing.base, alignItems: 'center' },
  // Welcome
  mk: { width: 74, height: 74, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  mkLetter: { fontFamily: LogoFont, fontWeight: FontWeight.bold, fontSize: 44, color: '#FBF3EA', lineHeight: 48 },
  halo: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, textAlign: 'center', letterSpacing: -0.4, marginTop: 6 },
  welcomeSub: { fontSize: FontSize.base, fontFamily: UIFontLight, textAlign: 'center', lineHeight: 21, paddingHorizontal: 6 },
  featureList: { gap: 4, marginTop: 10, alignSelf: 'stretch' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  featureText: { fontSize: FontSize.base, fontWeight: FontWeight.medium, fontFamily: UIFontLight },
  // Interests
  stepTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.4, alignSelf: 'flex-start' },
  stepSub: { fontSize: FontSize.base, fontFamily: UIFontLight, lineHeight: 21, alignSelf: 'flex-start', marginTop: -6 },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignSelf: 'stretch' },
  interestChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: BorderRadius.full, borderWidth: 1 },
  interestDot: { width: 6, height: 6, borderRadius: 3 },
  interestLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, fontFamily: UIFont },
  hintText: { fontSize: FontSize.sm, fontFamily: UIFontLight, textAlign: 'center', marginTop: 4 },
  interestsFooterRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  interestsCount: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  // Personalise
  avatarPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, alignSelf: 'stretch' },
  avatarPreview: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarPreviewPhoto: { width: '100%', height: '100%' },
  avatarInitials: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: UIFont },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', paddingVertical: 3 },
  avatarName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont, flex: 1 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4, alignSelf: 'flex-start' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignSelf: 'stretch' },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  bioInput: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, fontSize: FontSize.base, fontFamily: UIFontLight, minHeight: 80, textAlignVertical: 'top', alignSelf: 'stretch' },
  charCount: { fontSize: FontSize.xs, textAlign: 'right', alignSelf: 'stretch' },
  // Summary
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, alignSelf: 'stretch' },
  summaryAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  summaryAvatarPhoto: { width: '100%', height: '100%' },
  summaryInitials: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontFamily: UIFont },
  summaryInfo: { flex: 1, gap: 3 },
  summaryName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  summaryUni: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  summaryInterests: { fontSize: FontSize.xs, marginTop: 2 },
  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: Spacing.sm, padding: Spacing.gutter, borderTopWidth: 1 },
});
