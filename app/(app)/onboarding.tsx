import React, { useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Animated, Dimensions, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { INTERESTS } from '@/core/constants/interests';

const { width: SW } = Dimensions.get('window');

const AVATAR_COLORS = [
  '#C94D0A', '#8B3FCC', '#0A8A52', '#2952CC',
  '#CC1F6E', '#CC6B00', '#0891B2', '#DC2626',
  '#7C3AED', '#059669', '#D97706', '#DB2777',
];

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
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? '#C94D0A');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);

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
    await completeOnboarding({ interests: selectedInterests, bio, avatarColor });
    router.replace('/(app)');
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  const steps = [
    // Step 0: Welcome
    <View key="welcome" style={styles.stepContent}>
      <Text style={styles.welcomeEmoji}>🎓</Text>
      <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>
        {t.onboardingWelcome(user?.name?.split(' ')[0] ?? '')}
      </Text>
      <Text style={[styles.welcomeSub, { color: colors.textSecondary }]}>
        {t.onboardingWelcomeSub}
      </Text>
      <View style={styles.featureList}>
        {[
          ['📅', t.onboardingFeature1],
          ['👥', t.onboardingFeature2],
          ['🗺️', t.onboardingFeature3],
          ['🔔', t.onboardingFeature4],
        ].map(([emoji, text]) => (
          <View key={text} style={[styles.featureRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
            <Text style={styles.featureEmoji}>{emoji}</Text>
            <Text style={[styles.featureText, { color: colors.textPrimary }]}>{text}</Text>
          </View>
        ))}
      </View>
    </View>,

    // Step 1: Interests
    <View key="interests" style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t.onboardingInterestsTitle}</Text>
      <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
        {t.onboardingInterestsSub}
      </Text>
      <View style={styles.interestGrid}>
        {INTERESTS.map(({ key, tKey, emoji }) => {
          const selected = selectedInterests.includes(key);
          return (
            <AnimatedPressable
              key={key}
              onPress={() => toggleInterest(key)}
              style={[
                styles.interestChip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
                selected && (Shadow.sm as object),
              ]}
            >
              <Text style={styles.interestEmoji}>{emoji}</Text>
              <Text style={[styles.interestLabel, { color: selected ? '#fff' : colors.textPrimary }]}>
                {t[tKey as keyof typeof t] as string}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
      {selectedInterests.length > 0 && selectedInterests.length < 3 && (
        <Text style={[styles.hintText, { color: colors.textHint }]}>
          {t.onboardingInterestsPick(3 - selectedInterests.length)}
        </Text>
      )}
    </View>,

    // Step 2: Personalise
    <View key="personalise" style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{t.onboardingPersonaliseTitle}</Text>
      <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
        {t.onboardingPersonaliseSub}
      </Text>

      {/* Avatar preview */}
      <View style={styles.avatarPreviewRow}>
        <View style={[styles.avatarPreview, { backgroundColor: avatarColor, borderColor: colors.borderStrong }]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <Text style={[styles.avatarName, { color: colors.textPrimary }]}>{user?.name}</Text>
      </View>

      {/* Colour picker */}
      <Text style={[styles.colorLabel, { color: colors.textSecondary }]}>{t.onboardingPickColor}</Text>
      <View style={styles.colorGrid}>
        {AVATAR_COLORS.map((c) => (
          <AnimatedPressable
            key={c}
            onPress={() => setAvatarColor(c)}
            style={[
              styles.colorDot,
              { backgroundColor: c },
              avatarColor === c && { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.15 }] },
            ]}
          />
        ))}
      </View>

      {/* Bio */}
      <Text style={[styles.colorLabel, { color: colors.textSecondary }]}>{t.onboardingBioLabel}</Text>
      <TextInput
        style={[styles.bioInput, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.textPrimary }]}
        placeholder={t.onboardingBioPlaceholder(user?.department ?? 'Student', user?.universityName ?? 'University')}
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
      <Text style={styles.doneEmoji}>🚀</Text>
      <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>{t.onboardingDoneTitle}</Text>
      <Text style={[styles.welcomeSub, { color: colors.textSecondary }]}>
        {t.onboardingDoneSub}
      </Text>
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
        <View style={[styles.summaryAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.summaryInitials}>{initials}</Text>
        </View>
        <View style={styles.summaryInfo}>
          <Text style={[styles.summaryName, { color: colors.textPrimary }]}>{user?.name}</Text>
          <Text style={[styles.summaryUni, { color: colors.textSecondary }]}>
            🎓 {universityLabel(user?.universityName ?? '', language)}
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
      </View>
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
                width: i === step ? 20 : 8,
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

      {/* CTA footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {step > 0 && (
          <AnimatedPressable onPress={() => animateTo(step - 1)} style={[styles.backBtn, { borderColor: colors.border }]}>
            <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>{t.onboardingBtnBack}</Text>
          </AnimatedPressable>
        )}
        <AnimatedPressable
          onPress={isLast ? handleFinish : () => animateTo(step + 1)}
          disabled={!canAdvance || saving}
          style={[
            styles.nextBtn,
            { backgroundColor: canAdvance ? colors.primary : colors.border, borderColor: colors.borderStrong },
            step === 0 && { flex: 1 },
          ]}
        >
          <Text style={styles.nextBtnText}>
            {saving ? t.onboardingBtnSaving : isLast ? t.onboardingBtnFinish : step === 0 ? t.onboardingBtnGetStarted : t.onboardingBtnContinue}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingBottom: 8,
  },
  dot: { height: 8, borderRadius: 4 },
  scrollContent: { padding: Spacing.xl },
  stepContent: { gap: Spacing.lg },
  // Welcome
  welcomeEmoji: { fontSize: 64, textAlign: 'center' },
  doneEmoji: { fontSize: 64, textAlign: 'center' },
  welcomeTitle: { fontSize: FontSize.display, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, textAlign: 'center', lineHeight: 38 },
  welcomeSub: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  featureList: { gap: Spacing.sm, marginTop: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1.5 },
  featureEmoji: { fontSize: 22 },
  featureText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  // Interests
  stepTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  stepSub: { fontSize: FontSize.md, lineHeight: 22, marginTop: -Spacing.sm },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: BorderRadius.full, borderWidth: 2 },
  interestEmoji: { fontSize: 16 },
  interestLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  hintText: { fontSize: FontSize.sm, textAlign: 'center', marginTop: 4 },
  // Personalise
  avatarPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: 8 },
  avatarPreview: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  avatarName: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, flex: 1 },
  colorLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  bioInput: { borderRadius: BorderRadius.lg, borderWidth: 1.5, padding: Spacing.md, fontSize: FontSize.sm, minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: FontSize.xs, textAlign: 'right', marginTop: -Spacing.sm },
  // Summary
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 2.5, ...Shadow.sm },
  summaryAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  summaryInitials: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  summaryInfo: { flex: 1, gap: 3 },
  summaryName: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  summaryUni: { fontSize: FontSize.sm },
  summaryInterests: { fontSize: FontSize.xs, marginTop: 2 },
  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1 },
  backBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 14, borderRadius: BorderRadius.full, borderWidth: 2, justifyContent: 'center' },
  backBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  nextBtn: { flex: 1, paddingVertical: 16, borderRadius: BorderRadius.full, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
});
